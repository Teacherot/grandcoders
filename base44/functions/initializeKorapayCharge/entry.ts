import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { feeInclusiveTotal, feeAmount } from '../../shared/fee.ts';

// Starts a KoraPay charge for a storefront order and returns the reference +
// public key the client uses to open the inline checkout modal. Called from
// the public storefront (no user auth) — only the KoraPay public key is sent
// to the client; the secret key stays server-side.
//
// SECURITY: the charge amount is computed server-side from the package + the
// agent's sell price, NOT trusted from the client. A customer otherwise could
// open a GHS 1 modal for a GHS 23 bundle, get it "verified", and have the order
// created at the full price while only paying 1 — debiting the agent's wallet
// the real cost for a 1 payment.
//
// KoraPay amounts are in MAJOR currency units (GHS), not pesewas — confirmed
// from their docs (card-charge minimum is "NGN 200.00" while the sample uses
// amount: 1000, so 1000 = 1000 naira, not kobo).
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, order, return_url } = body;
    if (!email || !String(email).includes('@')) {
      return Response.json({ error: 'A valid email is required' }, { status: 400 });
    }
    const om = order && typeof order === 'object' ? order : null;
    if (!om || !om.network || om.volume_gb == null || !om.store_slug || !om.recipient_number) {
      return Response.json({ error: 'Order details are required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Resolve the agent from the store slug (authoritative) — never trust a
    // client-supplied agent_id, which could attribute the order (and the
    // agent's commission) to a different agent.
    const wantSlug = String(om.store_slug).toLowerCase().trim();
    const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const allAgents = await base44.asServiceRole.entities.Agent.list();
    const agent = (allAgents || []).find((a) => (a.store_slug || slugify(a.full_name)) === wantSlug);
    if (!agent) return Response.json({ error: 'Store not found' }, { status: 400 });
    if (agent.store_active === false) return Response.json({ error: 'Store unavailable' }, { status: 400 });

    const pkgs = await base44.asServiceRole.entities.Package.filter({ network: om.network, active: true });
    const pkg = (pkgs || []).find((p) => Number(p.volume_gb) === Number(om.volume_gb));
    if (!pkg) {
      return Response.json({ error: 'Could not price this bundle. Please refresh and try again.' }, { status: 400 });
    }
    const prices = await base44.asServiceRole.entities.AgentPrice.filter({ agent_id: agent.id, package_id: pkg.id });
    const ap = (prices || []).find((p) => p.active);
    const base = Number(pkg.agent_price ?? pkg.price);
    const price = ap?.price != null && Number(ap.price) >= base ? Number(ap.price) : base;

    if (!price || price < 1) {
      return Response.json({ error: 'Amount must be at least GHS 1' }, { status: 400 });
    }

    // The customer pays the agent's sell price + a fixed KoraPay fee (baked in,
    // "no hidden charges"). The agent is only ever credited commission on the
    // sell price — the fee portion covers KoraPay's transaction cost and is
    // never credited to the agent.
    const total = feeInclusiveTotal(price);
    const fee = feeAmount(price);

    // KoraPay requires a minimum of GHS 10 for mobile money payments. The
    // minimum applies to the amount actually charged (the fee-inclusive total).
    const MOMO_MIN_GHS = 10;
    if (total < MOMO_MIN_GHS) {
      return Response.json({
        error: `This bundle's total is GHS ${total.toFixed(2)} (incl. charges), but mobile money payments require a minimum of GHS ${MOMO_MIN_GHS}. Please choose a larger bundle.`,
      }, { status: 400 });
    }

    const secret = secrets.get('KORAPAY_SECRET_KEY');
    if (!secret) {
      return Response.json({ error: 'KoraPay is not configured yet' }, { status: 500 });
    }

    // Reference must be unique and at least 8 characters (KoraPay requirement).
    const reference = `DFP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const redirectUrl = return_url
      ? `${return_url}${return_url.includes('?') ? '&' : '?'}kpay_ref=${encodeURIComponent(reference)}`
      : undefined;

    // Create the charge server-side and redirect the customer to KoraPay's
    // hosted checkout. The inline modal (public key) is rejected for this
    // merchant account with a generic "contact the business" message, but the
    // server-side charge init (secret key) works reliably and returns a
    // checkout_url the customer is redirected to.
    const chargeRes = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(total.toFixed(2)),
        currency: 'GHS',
        reference,
        customer: { email, name: om.customer_name || 'Customer' },
        channels: ['mobile_money'],
        ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
      }),
    });
    const chargeData = await chargeRes.json().catch(() => ({}));
    if (!chargeData.status || !chargeData.data?.checkout_url) {
      return Response.json({ error: chargeData.message || 'Could not start payment. Please try again.' }, { status: 400 });
    }

    // Persist the pending order meta server-side (keyed by the KoraPay
    // reference) so the KoraPay webhook can create the Order on charge.success
    // if the customer's browser never returns from the hosted checkout
    // redirect (closed tab, network drop, polling missed the success flip).
    // Without this, a successful payment with no returning client would charge
    // the customer but create no order — losing the order ID and the agent's
    // commission. Cleaned up once the order is actually created.
    try {
      const rows = await base44.asServiceRole.entities.Setting.filter({ key: `korapay_pending:${reference}` }, '-created_date', 1);
      const meta = {
        store_slug: wantSlug,
        agent_id: agent.id,
        network: om.network,
        volume_gb: om.volume_gb,
        recipient_number: om.recipient_number,
        customer_name: om.customer_name || '',
        sell_price: Number(price.toFixed(2)),
        total: Number(total.toFixed(2)),
        fee: Number(fee.toFixed(2)),
      };
      const value = JSON.stringify(meta);
      if (rows[0]) {
        await base44.asServiceRole.entities.Setting.update(rows[0].id, { value });
      } else {
        await base44.asServiceRole.entities.Setting.create({ key: `korapay_pending:${reference}`, value, label: 'Pending storefront order meta' });
      }
    } catch {}

    return Response.json({ reference, checkout_url: chargeData.data.checkout_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}