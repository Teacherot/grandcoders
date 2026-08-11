import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { pick, safeEqual, hmacSha256Hex, createDiagnosticSaver } from '../../shared/webhook.ts';
import { finalizeStorefrontOrder } from '../../shared/storefrontOrder.ts';

// Inbound webhook from KoraPay for payment validation.
// Give KoraPay this function's endpoint URL (dashboard -> code -> functions -> korapayWebhook)
// under Settings -> Webhooks, subscribing to: charge.success, charge.failed, refund.success.
//
// KoraPay authenticates by signing ONLY the `data` object of the payload with
// HMAC-SHA256 using your secret key:
//   header: x-korapay-signature: <hex>
//   signature = HMAC_SHA256(KORAPAY_SECRET_KEY, JSON.stringify(body.data))
//
// This is a push-based backup to the existing client-callback verification
// (placeStorefrontOrder pulls GET /charges/{reference} on onSuccess). It covers
// dropped client callbacks (modal closed before onSuccess fired) and refund
// events the pull flow can't detect. It CAN create orders on its own as a
// fallback: when a charge succeeds but no order exists yet (the customer's
// browser never returned from the hosted checkout, or the client polling
// missed the success flip), it reconstructs the order from the pending meta
// stored at charge initialization. Idempotent on the reference — if the client
// path already created the order, the webhook returns that existing order
// instead of duplicating it.

// Verify KoraPay's HMAC-SHA256 signature over JSON.stringify(body.data).
// KoraPay signs only the `data` object (not the raw body), so we must
// re-serialize the parsed `data` and compare the hex digests in constant time.
async function verifySignature(dataObject, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = await hmacSha256Hex(secret, JSON.stringify(dataObject));
  return safeEqual(expected, signatureHeader);
}

export default async function(req) {
  const base44 = createClientFromRequest(req);

  // Capture every delivery up-front so we can diagnose KoraPay's exact
  // payload + signature even when verification fails.
  const rawBody = await req.text().catch(() => '');
  const signatureHeader =
    req.headers.get('x-korapay-signature') ||
    req.headers.get('X-Korapay-Signature') ||
    '';
  const saveDiagnostic = createDiagnosticSaver(base44, 'korapay_last_webhook', 'KoraPay last webhook (diagnostic)', [
    'x-korapay-signature',
    'content-type',
    'user-agent',
  ]);
  const save = (info) => saveDiagnostic(rawBody, req, { signatureHeader, ...info });

  try {
    const secret = secrets.get('KORAPAY_SECRET_KEY');
    if (!secret) {
      await save({ status: 'no_secret' });
      return Response.json({ error: 'KoraPay secret not configured' }, { status: 500 });
    }

    const body = JSON.parse(rawBody || '{}');
    const event = String(body.event || body.type || '').toLowerCase();
    const data = body.data && typeof body.data === 'object' ? body.data : body;

    // Authenticate KoraPay with an HMAC-SHA256 signature over JSON.stringify(data).
    // No token fallback — KoraPay always signs, so a missing/mismatched signature
    // means the request is not from KoraPay.
    const sigOk = await verifySignature(data, signatureHeader, secret);
    if (!sigOk) {
      await save({ status: 'unauthorized', event, hasData: !!body.data });
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ref = String(pick(data, 'reference', 'payment_reference', 'reference_code', 'order_reference', 'ref', 'id') || '');

    // Resolve the matching order (by reference, then code, then id) — same chain
    // as gmplWebhook.
    let order = null;
    if (ref) {
      const byRef = await base44.asServiceRole.entities.Order.filter({ reference: ref }, '-created_date', 5);
      order = byRef[0];
      if (!order) {
        const byCode = await base44.asServiceRole.entities.Order.filter({ code: ref }, '-created_date', 5);
        order = byCode[0];
      }
      if (!order) {
        try { order = await base44.asServiceRole.entities.Order.get(ref); } catch {}
      }
    }

    // Map KoraPay events -> order status. charge.success is idempotent — if the
    // order already exists it's being handled by the client-callback + supplier
    // flow, so we leave it alone; if no order exists yet the client callback
    // hasn't fired, and the webhook can't reconstruct the order (it lacks
    // recipient/network/volume), so we store the delivery for manual review.
    let newStatus = null;
    let tag = null;

    if (event === 'charge.success') {
      // The client-callback path (placeStorefrontOrder) normally creates the
      // order when the customer returns from hosted checkout. But if the
      // browser never returns (closed tab, network drop) or the polling missed
      // the "processing" → "success" flip, no order would exist — the customer
      // is charged but the order, supplier push, and agent commission are all
      // lost. Fall back to creating the order here from the pending meta stored
      // at charge initialization, so a successful payment always produces an
      // order. Idempotent on the reference (the helper returns the existing
      // order if the client path already won the race).
      if (!order) {
        try {
          const metaRows = await base44.asServiceRole.entities.Setting.filter({ key: `korapay_pending:${ref}` }, '-created_date', 1);
          const metaRow = metaRows[0];
          if (metaRow) {
            const om = JSON.parse(metaRow.value || '{}');
            const gmplKey = secrets.get('GMPL_API_KEY');
            const gmplBase = (secrets.get('GMPL_API_BASE') || 'https://getmorepaylessdatahouse.net').replace(/\/$/, '');
            const result = await finalizeStorefrontOrder(base44, ref, om, { korapaySecret: secret, gmplKey, gmplBase });
            if (result.ok) {
              order = result.order;
              // The order now exists — the pending meta is no longer needed.
              try { await base44.asServiceRole.entities.Setting.delete(metaRow.id); } catch {}
            }
          }
        } catch (e) {
          // Best-effort fallback — never fail the webhook response over it.
        }
      }
      // No status change from the payment webhook itself; the supplier webhook
      // drives status forward from here.
      newStatus = null;
    } else if (event === 'charge.failed') {
      newStatus = 'failed';
      tag = 'korapay-failed';
      // The charge failed — no order will be created for this reference, so
      // discard the pending meta stored at initialization.
      if (!order) {
        try {
          const metaRows = await base44.asServiceRole.entities.Setting.filter({ key: `korapay_pending:${ref}` }, '-created_date', 1);
          if (metaRows[0]) await base44.asServiceRole.entities.Setting.delete(metaRows[0].id);
        } catch {}
      }
    } else if (event === 'refund.success') {
      // Mirror the GMPL refund policy: tag the order and leave wallet credit for
      // manual end-of-day reconciliation. A webhook must never move balances.
      newStatus = 'failed';
      tag = 'korapay-refund';
    }

    if (order && newStatus) {
      const patch = { status: newStatus };
      await base44.asServiceRole.entities.Order.update(order.id, patch);
    }

    await save({ status: 'ok', event, ref, matched: !!order, newStatus });
    return Response.json({ ok: true, event, ref, matched: !!order, newStatus });
  } catch (error) {
    await save({ status: 'error', error: error.message });
    return Response.json({ error: error.message }, { status: 500 });
  }
}