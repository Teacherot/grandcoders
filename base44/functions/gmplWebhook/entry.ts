import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { pick, safeEqual, hmacSha256Hex, createDiagnosticSaver } from '../../shared/webhook.ts';

// Inbound webhook from the GMPL supplier.
// Give GMPL this function's endpoint URL (dashboard -> code -> functions -> gmplWebhook).
// GMPL authenticates by signing the raw body with HMAC-SHA256:
//   header: X-Telecom-Signature: t=<unix-ts>,v1=<hex>
//   signature = HMAC_SHA256(GMPL_WEBHOOK_SECRET, `${t}.${rawBody}`)

// Verify GMPL's HMAC-SHA256 signature on the raw request body.
// GMPL sends: X-Telecom-Signature: t=<timestamp>,v1=<hex>
// Recompute HMAC over `${timestamp}.${rawBody}` with the signing secret and
// compare to v1 in constant time. Reject anything older than ~5 minutes.
async function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = {};
  for (const p of String(signatureHeader).split(",")) {
    const eq = p.indexOf("=");
    if (eq > 0) parts[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const ts = Number(t);
  if (!isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false; // 5-min replay window
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  return safeEqual(expected, v1);
}

export default async function(req) {
  const base44 = createClientFromRequest(req);

  // Capture EVERY delivery up-front (before auth) so we can diagnose GMPL's
  // exact payload + signature header format even when verification fails.
  const rawBody = await req.text().catch(() => '');
  const signatureHeader =
    req.headers.get('stripe-signature') ||
    req.headers.get('x-telecom-signature') ||
    req.headers.get('x-gmpl-signature') ||
    req.headers.get('x-webhook-signature') ||
    req.headers.get('signature') ||
    '';
  const saveDiagnostic = createDiagnosticSaver(base44, 'gmpl_last_webhook', 'GMPL last webhook (diagnostic)', [
    'stripe-signature',
    'x-telecom-signature',
    'x-gmpl-signature',
    'x-webhook-signature',
    'signature',
    'content-type',
    'user-agent',
  ]);
  const save = (info) => saveDiagnostic(rawBody, req, { signatureHeader, ...info });

  try {
    // Authenticate GMPL with an HMAC-SHA256 signature over the raw body.
    // Without this, anyone could POST a fake webhook and trigger wallet
    // refunds or set arbitrary balances.
    const signingSecret = secrets.get('GMPL_WEBHOOK_SECRET');
    if (!signingSecret) {
      await save({ status: 'no_secret' });
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    // GMPL's webhook registration (url + events) has no signing-secret field,
    // so it does NOT HMAC-sign its deliveries. Accept the shared token ONLY via
    // a header — never as a ?token= query param, which leaks into access/proxy
    // logs and is trivially replayable. Fall back to HMAC verification if a
    // signature IS present.
    const tokenHeader =
      req.headers.get('x-telecom-token') ||
      req.headers.get('x-gmpl-token') ||
      '';
    const tokenOk = !!tokenHeader && safeEqual(tokenHeader, signingSecret);
    const sigOk = await verifySignature(rawBody, signatureHeader, signingSecret);
    if (!tokenOk && !sigOk) {
      await save({ status: 'unauthorized', tokenOk, sigOk });
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(rawBody || '{}');
    const event = String(pick(body, "event", "type", "event_type", "eventType") || "").toLowerCase();
    const data = body.data && typeof body.data === "object" ? body.data : body;

    const ref = String(pick(data, "reference", "reference_code", "order_reference", "orderReference", "ref", "order_id", "orderId", "id", "code") || "");

    // Resolve the matching order (by reference, then supplier id, then code, then id).
    let order = null;
    if (ref) {
      const byRef = await base44.asServiceRole.entities.Order.filter(
        { reference: ref },
        "-created_date",
        5
      );
      order = byRef[0];

      // After the reference fix, the supplier's order ID is stored
      // separately in gmpl_order_id.
      if (!order) {
        const byGmplId = await base44.asServiceRole.entities.Order.filter(
          { gmpl_order_id: ref },
          "-created_date",
          5
        );
        order = byGmplId[0];
      }

      if (!order) {
        const byCode = await base44.asServiceRole.entities.Order.filter({ code: ref }, "-created_date", 5);
        order = byCode[0];
      }

      if (!order) {
        try {
          order = await base44.asServiceRole.entities.Order.get(ref);
        } catch {}
      }
    }

    // Map GMPL event -> order status + refund flag.
    // Some webhooks send `status` instead of `event`; accept both.
    const rawStatus = String(pick(data, "status", "order_status", "orderStatus", "state") || "").toLowerCase();
    const signal = event || rawStatus;

    let newStatus = null;
    let refund = false;
    let partial = false;
    if (["order.approved", "purchase.success", "order.completed", "order.delivered",
         "order.fulfilled", "delivery.success", "order.success", "purchase.completed",
         "order.done", "delivered", "completed", "fulfilled", "success", "approved"].includes(signal)) {
      newStatus = "completed";
    } else if (signal === "order.partially_approved" || signal === "partially_approved" || signal === "partial") {
      newStatus = "completed"; partial = true;
    } else if (["order.received", "order.processing", "order.queued", "order.pending",
               "processing", "queued", "pending", "received"].includes(signal)) {
      newStatus = "processing";
    } else if (["order.rejected", "purchase.failed", "order.failed", "order.declined",
                "order.cancelled", "rejected", "failed", "declined", "error", "cancelled"].includes(signal)) {
      newStatus = "failed"; refund = true;
    }

    let walletCredited = false;

    if (order && newStatus) {
      // Replay guard: a repeated event for an order already in that state is a
      // replay — don't re-tag the reference or re-apply the status. GMPL
      // doesn't sign, so this idempotent check (plus the header-only token)
      // limits what a captured-token replay can do.
      if (order.status === newStatus) {
        await save({ status: 'duplicate', event, signal, ref });
        return Response.json({ ok: true, duplicate: true, event, signal, matched: !!order });
      }
      const patch = { status: newStatus };
      if (refund || partial) {
        // Keep the payment reference untouched.
        // The order status already records the supplier outcome.
      }
      await base44.asServiceRole.entities.Order.update(order.id, patch);

      // Supplier issued a refund — we do NOT auto-credit the agent's wallet.
      // The admin reconciles and refunds agents manually at end of business,
      // so the order is just marked failed here for later review.
      // (The "supplier-refund" tag on the reference records that GMPL credited us.)
    }

    // SECURITY: wallet balance overwrite removed. A webhook-supplied balance is
    // untrusted — a forged/replayed delivery could set any agent's wallet to any
    // value. Wallet balances are now owned only by the debit/credit functions.
    await save({ status: 'ok', event, signal, ref, matched: !!order, newStatus });
    return Response.json({ ok: true, event, signal, matched: !!order, newStatus, walletCredited });
  } catch (error) {
    await save({ status: 'error', error: error.message });
    return Response.json({ error: error.message }, { status: 500 });
  }
}