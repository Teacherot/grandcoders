// Shared storefront order finalization — used by BOTH the client-callback
// path (placeStorefrontOrder, called when the customer returns from KoraPay's
// hosted checkout) AND the KoraPay webhook (korapayWebhook, the push-based
// backup). This guarantees the Order is ALWAYS created when a charge succeeds,
// even if the customer's browser never returns from the redirect, the client
// polling misses the "processing" → "success" flip, or the tab is closed.
//
// Both paths are idempotent on the KoraPay reference via a Setting-based
// creation lock: whichever path acquires the lock creates the order and the
// other returns the existing one — never a duplicate.
//
// The agent is resolved from the store slug (authoritative), never trusted
// from the client payload, so a customer can't attribute an order to a
// different agent.

import { pushOrderToProvider } from './gmpl.ts';
import { feeInclusiveTotal } from './fee.ts';

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function resolveAgentBySlug(base44, storeSlug) {
  if (!storeSlug) return null;
  const want = String(storeSlug).toLowerCase().trim();
  const agents = await base44.asServiceRole.entities.Agent.list();
  return (agents || []).find((a) => (a.store_slug || slugify(a.full_name)) === want) || null;
}

// Short digits-only order ID a customer can copy and later enter on the
// storefront "Check Order" tab. 6 digits, uniqueness-checked against existing
// orders; falls back to a timestamp-derived 6-digit code if collisions persist.
async function genOrderCode(base44) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const clash = await base44.asServiceRole.entities.Order.filter({ code }, '-created_date', 1);
    if (!clash || !clash.length) return code;
  }
  return String(Date.now()).slice(-6);
}

// Finalize a storefront order for a KoraPay reference. Returns:
//   { ok: true, verified: true, order, provider?, duplicate? }  — order created/found
//   { verified: false, status, retryable }                       — charge not yet success
//   { error }                                                    — hard failure (pricing/agent/amount)
export async function finalizeStorefrontOrder(base44, reference, om, { korapaySecret, gmplKey, gmplBase }) {
  // Idempotency: if an Order already exists for this reference, return it
  // instead of creating a duplicate (replayed callback or webhook + client race).
  const existing = await base44.asServiceRole.entities.Order.filter({ reference }, '-created_date', 1);
  if (existing && existing[0]) {
    return { ok: true, verified: true, order: existing[0], duplicate: true };
  }

  const res = await fetch(`https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${korapaySecret}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!data.status) return { verified: false, error: data.message || 'verification failed' };
  const charge = data.data || {};
  // KoraPay's charge often still reads "processing" / "pending" right after
  // the customer is redirected back from hosted checkout — the success state
  // lands a few seconds later. Distinguish that transient state (retryable)
  // from a hard failure (failed / cancelled / etc.) so the client polls
  // instead of showing a false "Payment could not be confirmed" screen.
  if (charge.status !== 'success') {
    const retryable = charge.status === 'processing' || charge.status === 'pending' || charge.status === 'initiated';
    return { verified: false, status: charge.status, retryable };
  }

  // Resolve the agent from the store slug (authoritative). The client path
  // passes store_slug; the webhook path's stored meta also has store_slug. We
  // never trust om.agent_id from the client — if both are present, slug wins.
  // The agent_id fallback is only for server-stored webhook meta (trusted).
  let agent = null;
  if (om.store_slug) {
    agent = await resolveAgentBySlug(base44, om.store_slug).catch(() => null);
  }
  if (!agent && om.agent_id) {
    agent = await base44.asServiceRole.entities.Agent.get(om.agent_id).catch(() => null);
  }
  if (!agent) return { error: 'Store not found' };
  if (agent.store_active === false) return { error: 'Store unavailable' };

  // Recompute the authoritative price from the package + agent price — never
  // trust the client's amount. KoraPay returns amount_paid as a decimal
  // string in major currency units (GHS).
  const pkgs = await base44.asServiceRole.entities.Package.filter({ network: om.network, active: true });
  const pkg = (pkgs || []).find((p) => Number(p.volume_gb) === Number(om.volume_gb));
  if (!pkg) return { error: 'Could not price this bundle' };
  const prices = await base44.asServiceRole.entities.AgentPrice.filter({ agent_id: agent.id, package_id: pkg.id });
  const ap = (prices || []).find((p) => p.active);
  const base = Number(pkg.agent_price ?? pkg.price);
  const sell = ap?.price != null && Number(ap.price) >= base ? Number(ap.price) : base;
  // The customer was charged the fee-inclusive total (sell + KoraPay fee), so
  // verification compares the paid amount to that total — not the sell price.
  // The Order itself records the sell price as its amount, which is the basis
  // for the agent's commission (commission_rate% × sell), so the fee never
  // inflates the agent's profit.
  const total = feeInclusiveTotal(sell);

  const paid = Number(charge.amount_paid != null ? charge.amount_paid : charge.amount);
  if (!Number.isFinite(paid) || Math.abs(paid - total) > 0.01) {
    return { error: 'Paid amount does not match the order amount' };
  }

  // Creation lock: a second path (webhook racing the client return) could
  // pass the existing-order check above and create a duplicate. Acquire a
  // Setting lock keyed by reference; if one already exists, the other path is
  // mid-creation — re-read the order and return it (or signal retry). The lock
  // is released in finally; stale locks are also swept by the daily cleanup.
  const lockKey = `korapay_lock:${reference}`;
  let lockRow = null;
  try {
    const locks = await base44.asServiceRole.entities.Setting.filter({ key: lockKey }, '-created_date', 1);
    lockRow = locks && locks[0];
  } catch {}
  if (lockRow) {
    await new Promise((r) => setTimeout(r, 600));
    const again = await base44.asServiceRole.entities.Order.filter({ reference }, '-created_date', 1);
    if (again && again[0]) return { ok: true, verified: true, order: again[0], duplicate: true };
    return { verified: false, status: 'processing', retryable: true };
  }
  try {
    await base44.asServiceRole.entities.Setting.create({ key: lockKey, value: new Date().toISOString(), label: 'Storefront order creation lock' });
  } catch {
    const again = await base44.asServiceRole.entities.Order.filter({ reference }, '-created_date', 1);
    if (again && again[0]) return { ok: true, verified: true, order: again[0], duplicate: true };
  }

  let order;
  try {
    order = await base44.asServiceRole.entities.Order.create({
      code: await genOrderCode(base44),
      customer_name: om.customer_name || '',
      recipient_number: String(om.recipient_number),
      network: pkg.network,
      package_name: pkg.name,
      volume_gb: Number(pkg.volume_gb) || 0,
      amount: Number(sell) || 0,
      reference,
      payment_reference: reference,
      agent_id: agent.id,
      agent_name: agent.full_name,
      agent_email: agent.email || '',
      status: 'pending',
      payment_method: 'momo',
      source: 'store',
    });
  } finally {
    try {
      const locks2 = await base44.asServiceRole.entities.Setting.filter({ key: lockKey }, '-created_date', 1);
      if (locks2 && locks2[0]) await base44.asServiceRole.entities.Setting.delete(locks2[0].id);
    } catch {}
  }

  let provider = null;
  try {
    provider = await pushOrderToProvider(base44, {
      apiKey: gmplKey,
      base: gmplBase,
      orderId: order.id,
      recipientNumber: String(om.recipient_number),
      network: pkg.network,
      volumeGb: Number(pkg.volume_gb) || 0,
    });
  } catch (e) {
    provider = { ok: false, error: e.message };
  }

  const updated = await base44.asServiceRole.entities.Order.get(order.id);
  return { ok: true, verified: true, order: updated, provider };
}