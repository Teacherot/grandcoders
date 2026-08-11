import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { rateLimit } from '../../shared/ratelimit.ts';
import { finalizeStorefrontOrder } from '../../shared/storefrontOrder.ts';

// Recovers a storefront order from a KoraPay transaction reference when the
// hosted-checkout return flow broke (closed tab, lost session meta, redirect
// failed, customer came back later with only the transaction ID from their
// payment receipt). The pending order meta saved at charge initialization
// (korapay_pending:<reference>) holds everything the shared finalizer needs,
// so the customer only needs the transaction ID to retrieve their Order ID.
//
// Reuses finalizeStorefrontOrder (idempotent on the reference): if the webhook
// already created the order, or the client return already finalized it, the
// existing order is returned — never a duplicate.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    const allowed = await rateLimit(base44, ip, 'storefront_verify', 15, 10 * 60 * 1000);
    if (!allowed) return Response.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const reference = String(body.reference || '').trim();
    if (!reference) return Response.json({ error: 'Transaction ID is required' }, { status: 400 });

    const secret = secrets.get('KORAPAY_SECRET_KEY');
    if (!secret) return Response.json({ error: 'KoraPay is not configured yet' }, { status: 500 });
    const gmplKey = secrets.get('GMPL_API_KEY');
    const gmplBase = (secrets.get('GMPL_API_BASE') || 'https://getmorepaylessdatahouse.net').replace(/\/$/, '');

    const sanitize = (o) => ({
      id: o.id,
      code: o.code || '',
      package_name: o.package_name || '',
      network: o.network || '',
      amount: o.amount,
      recipient_number: o.recipient_number,
      status: o.status,
      created_date: o.created_date,
      evidence_url: o.evidence_url || '',
      reference: o.reference || '',
      gmpl_order_id: o.gmpl_order_id || '',
    });

    /*
     * STEP 1
     * Check whether we already have an Order using the KoraPay reference.
     *
     * This works after the new reference-handling fix because
     * Order.reference will permanently contain the KoraPay reference.
     */
    const existing = await base44.asServiceRole.entities.Order.filter(
      { reference },
      '-created_date',
      1
    );

    if (existing && existing[0]) {
      return Response.json({
        ok: true,
        verified: true,
        duplicate: true,
        order: sanitize(existing[0]),
      });
    }

    /*
     * STEP 2
     * Look for the server-side metadata saved when the KoraPay
     * payment was initialized.
     */
    let meta = null;
    let metaRowId = null;

    try {
      const rows =
        await base44.asServiceRole.entities.Setting.filter(
          { key: `korapay_pending:${reference}` },
          '-created_date',
          1
        );

      if (rows[0]) {
        metaRowId = rows[0].id;
        meta = JSON.parse(rows[0].value || 'null');
      }
    } catch (_) {}

    /*
     * STEP 3
     * If metadata exists, finalizeStorefrontOrder will verify the
     * transaction directly against KoraPay and create the order.
     */
    if (meta) {
      const result = await finalizeStorefrontOrder(
        base44,
        reference,
        meta,
        {
          korapaySecret: secret,
          gmplKey,
          gmplBase,
        }
      );

      if (result.ok) {
        if (metaRowId) {
          try {
            await base44.asServiceRole.entities.Setting.delete(metaRowId);
          } catch (_) {}
        }

        return Response.json({
          ok: true,
          verified: true,
          order: sanitize(result.order || {}),
          duplicate: !!result.duplicate,
        });
      }

      if (result.verified === false) {
        return Response.json({
          verified: false,
          status: result.status,
          retryable: !!result.retryable,
        });
      }

      return Response.json({
        error: result.error || 'Could not verify this transaction.',
      });
    }

    /*
     * STEP 4
     * IMPORTANT:
     * Even if our pending metadata is gone, we still verify the
     * transaction DIRECTLY with KoraPay.
     *
     * Previously the function incorrectly said "No payment found"
     * without ever asking KoraPay.
     */
    let chargeResponse;

    try {
      chargeResponse = await fetch(
        `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${secret}`,
          },
        }
      );
    } catch (e) {
      return Response.json({
        error: 'Unable to contact KoraPay. Please try again.',
      });
    }

    const chargeData =
      await chargeResponse.json().catch(() => ({}));

    if (!chargeResponse.ok || !chargeData.status) {
      return Response.json({
        error:
          chargeData.message ||
          'KoraPay could not find this transaction.',
      });
    }

    const charge = chargeData.data || {};
    const chargeStatus = String(charge.status || '').toLowerCase();

    if (
      chargeStatus === 'processing' ||
      chargeStatus === 'pending' ||
      chargeStatus === 'initiated'
    ) {
      return Response.json({
        verified: false,
        status: chargeStatus,
        retryable: true,
      });
    }

    if (chargeStatus !== 'success') {
      return Response.json({
        verified: false,
        status: chargeStatus || 'unknown',
        retryable: false,
        error: `KoraPay transaction status is ${chargeStatus || 'unknown'}.`,
      });
    }

    return Response.json({
      verified: true,
      payment_confirmed: true,
      recoverable: false,
      reference,
      amount_paid:
        charge.amount_paid != null
          ? charge.amount_paid
          : charge.amount,
      currency: charge.currency || 'GHS',
      error:
        'Payment was confirmed by KoraPay, but the order information needed to recover this order is no longer available. Please contact support with this Transaction ID.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}