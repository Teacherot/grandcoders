// Shared GMPL provider integration — used by both the app-user-facing
// pushOrderToGmpl function and the public agentApi endpoint, so the
// bundle-lookup + order-creation + local-status-update logic lives once.
// Secrets (apiKey/base) are read by the caller and passed in, keeping this
// module free of backend-runtime imports so it doesn't break the client build.

import { getSetting, setSetting } from './settings.ts';
import { debitAgentWallet } from './wallet.ts';

const parseVol = (v) => {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  const m = String(v).trim().toLowerCase();
  const num = parseFloat(m);
  if (!isFinite(num)) return NaN;
  if (m.includes('mb')) return num / 1024;
  if (m.includes('gb')) return num;
  return num;
};

// Scrub any "GMPL" mention from text that will be stored in the order reference
// or returned to the agent/customer UI, so the supplier identity is never
// exposed. Case-insensitive; collapses the standalone token to "supplier".
const scrub = (s) => String(s ?? '').replace(/\bGMPL\b/gi, 'supplier');

// Push a local order to the GMPL provider API. `base44` is a Base44 client
// constructed by the caller; entity updates use asServiceRole so they work
// from a public (no-user) context too.
export async function pushOrderToProvider(base44, { apiKey, base, orderId, recipientNumber, network, volumeGb }) {
  if (!apiKey) {
    return { ok: false, status: 'failed', error: 'GMPL API key not configured' };
  }

  // Guard: never reprocess an order that's already finished at the provider.
  const existing = await base44.asServiceRole.entities.Order.get(orderId).catch(() => null);
  if (existing && ['failed', 'cancelled', 'completed'].includes(existing.status)) {
    return { ok: false, skipped: true, status: existing.status, error: 'Order already ' + existing.status };
  }

  // Resolve the GMPL cost (Package.agent_price) for this order's bundle so the
  // agent's wallet is debited at least the supplier cost — even when the agent
  // sold below it. The shortfall (agent_price − order.amount) is recovered so
  // the platform never absorbs a loss on an underpriced sale.
  let gmplCost = 0;
  if (existing && existing.network) {
    try {
      const pkgs = await base44.asServiceRole.entities.Package.filter({ network: existing.network }, '-created_date', 200);
      const match = pkgs.find((p) => Number(p.volume_gb || 0) === Number(existing.volume_gb || 0));
      if (match) gmplCost = Number(match.agent_price || 0);
    } catch (_) { /* best-effort — falls back to order amount */ }
  }

  // Low-balance guard: only agent-funded orders require wallet balance.
  // Storefront/KoraPay orders are customer-paid and must bypass this check.
  if (existing && existing.agent_id && existing.source !== 'store') {
    const amt = Math.max(Number(existing.amount || 0), gmplCost);

    if (amt > 0) {
      const wallets = await base44.asServiceRole.entities.AgentWallet.filter(
        { agent_id: existing.agent_id },
        '-created_date',
        1
      );

      const w = wallets[0];
      const bal = w ? Number(w.balance || 0) : 0;

      if (bal < amt) {
        await base44.asServiceRole.entities.Order.update(orderId, {
          status: 'pending',
        });

        return {
          ok: false,
          status: 'pending',
          insufficient: true,
          error: 'Insufficient wallet balance',
          balance: bal,
          amount: amt,
        };
      }
    }
  }

  const authHeaders = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // 1. Find the GMPL bundle matching this network + volume.
  const bundlesRes = await fetch(`${base}/agent/bundles`, { headers: authHeaders });
  if (!bundlesRes.ok) {
    const txt = await bundlesRes.text();
    return { ok: false, status: 'failed', error: `Failed to fetch supplier bundles (${bundlesRes.status})`, details: txt };
  }
  const bundlesData = await bundlesRes.json();
  const bundles = Array.isArray(bundlesData)
    ? bundlesData
    : (bundlesData?.data?.data || bundlesData?.data || bundlesData?.bundles || []);
  const targetNet = String(network).toLowerCase();
  const bundle = bundles.find((b) => {
    const bNet = String(b.network || b.provider || '').toLowerCase();
    const bVol = parseVol(b.dataVolume ?? b.capacity ?? b.volumeGb ?? b.volume ?? b.size ?? b.amount);
    return bNet === targetNet && bVol === Number(volumeGb);
  });
  if (!bundle) {
    // No matching GMPL bundle right now — usually means the supplier has
    // closed stock. Keep the order pending so it can be re-pushed when the
    // bundle becomes available again, instead of failing it immediately.
    await base44.asServiceRole.entities.Order.update(orderId, {
      status: 'pending',
    });
    return { ok: false, status: 'pending', awaitingStock: true, error: `No supplier bundle for ${network} ${volumeGb}GB — awaiting stock` };
  }
  const bundleId = bundle.id || bundle.bundleId;

  // 2. Create the provider order with a fresh idempotency key.
  const idempotencyKey = crypto.randomUUID();
  const orderRes = await fetch(`${base}/agent/orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      bundleId,
      phoneNumber: String(recipientNumber),
      idempotencyKey,
    }),
  });
  const orderData = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) {
    // Provider rejected. Distinguish transient stock issues (keep pending so
    // the order retries when stock reopens) from permanent rejections such as
    // an unverified number (cancel so the agent can see and filter it, and so
    // the wallet is never debited). The error is stored in the order's
    // reference field for traceability.
    const errObj = orderData?.error;
    const errMsg = scrub(String(
      (errObj && typeof errObj === 'object' ? errObj.message : errObj) ||
        orderData?.message || `Supplier error ${orderRes.status}`
    ));
    const stockLike = /stock|out of stock|not available|no bundle|sold out|temporarily|unavailable|insufficient/.test(errMsg.toLowerCase());
    if (stockLike) {
      await base44.asServiceRole.entities.Order.update(orderId, {
        status: 'pending',
      });
      return { ok: false, status: 'pending', awaitingStock: true, error: errMsg, providerResponse: orderData };
    }
    await base44.asServiceRole.entities.Order.update(orderId, {
      status: 'cancelled',
    });
    return { ok: false, status: 'cancelled', error: errMsg, providerResponse: orderData };
  }

  const ord = orderData?.data || orderData;
  const providerOrderId = ord.id || ord.orderId || ord.order_id;
  const providerStatus = String(ord.status || ord.state || '').toLowerCase();
  let newStatus = 'processing';
  if (['approved', 'completed', 'fulfilled', 'success', 'delivered'].includes(providerStatus)) {
    newStatus = 'completed';
  } else if (['rejected', 'failed', 'declined', 'error'].includes(providerStatus)) {
    newStatus = 'failed';
  } else if (['pending', 'processing', 'queued'].includes(providerStatus)) {
    newStatus = 'processing';
  }

  await base44.asServiceRole.entities.Order.update(orderId, {
    status: newStatus,
    // NEVER overwrite the payment/reference identifier.
    // For storefront orders this is the KoraPay transaction reference.
    // The supplier's identifier belongs in gmpl_order_id.
    gmpl_order_id: providerOrderId ? String(providerOrderId) : undefined,
  });

  // Debit the agent's wallet on the first successful push (order was "pending").
  // The order amount is the agent's cost (agent_price), so this is what the
  // agent owes the platform. Retries on an already-processing order and
  // hard-failed orders are skipped above, so this never double-charges.
  // Debit the agent wallet ONLY for agent-funded orders.
  // Storefront orders are paid by the customer through KoraPay,
  // so the agent wallet must never be debited for them.
  if (
    existing &&
    existing.agent_id &&
    existing.source !== 'store' &&
    existing.status === 'pending' &&
    (newStatus === 'processing' || newStatus === 'completed')
  ) {
    // Debit at least the GMPL cost: if the agent sold below the supplier cost,
    // recover the shortfall so the platform never absorbs the difference.
    const orderAmt = Number(existing.amount || 0);
    const amt = Math.max(orderAmt, gmplCost);
    const shortfall = gmplCost > orderAmt ? gmplCost - orderAmt : 0;
    if (amt > 0) {
      const bal = await debitAgentWallet(base44, {
        agentId: existing.agent_id,
        agentName: existing.agent_name || '',
        amount: amt,
        notes: 'Order ' + (existing.code || orderId) + (shortfall > 0 ? ` (incl. GH₵ ${shortfall.toFixed(2)} below-cost recovery)` : ''),
      });
      if (bal != null) {
        // Low-balance warning: when the new balance falls below the configured
        // threshold, email the agent once (deduped per 24h) so they can top up
        // before their next order is blocked. Best-effort — never fails the order.
        try {
          const threshold = Number(await getSetting(base44, 'wallet_low_balance_threshold', '20'));
          if (threshold > 0 && bal < threshold) {
            const dedupeKey = `lowbal_notified_${existing.agent_id}`;
            const last = await getSetting(base44, dedupeKey, null);
            const recent = last && (Date.now() - new Date(last).getTime()) < 24 * 60 * 60 * 1000;
            if (!recent) {
              const agent = await base44.asServiceRole.entities.Agent.get(existing.agent_id).catch(() => null);
              const email = agent?.email;
              if (email) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  to: email,
                  subject: 'Low wallet balance — top up to avoid blocked orders',
                  body: `Hi ${agent.full_name || ''},\n\nYour wallet balance just dropped to GH₵ ${bal.toFixed(2)}, which is below the minimum of GH₵ ${threshold.toFixed(2)}.\n\nOrders that exceed your balance are held until you top up. Please add funds to your wallet to keep your store running smoothly.\n\n— GrandCoders Bundle Ops`,
                });
              }
              await setSetting(base44, dedupeKey, new Date().toISOString(), 'Low-balance notified marker');
            }
          }
        } catch (_) { /* notification is best-effort */ }
      }
    }
  }

  return { ok: true, status: newStatus, providerOrderId, providerStatus, providerResponse: orderData };
}