import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { finalizeStorefrontOrder } from '../../shared/storefrontOrder.ts';

// Completes a storefront order after the customer pays via KoraPay's hosted
// checkout. Delegates to the shared finalizeStorefrontOrder helper (also used
// by the KoraPay webhook) so the order-creation + charge-verification + price
// recompute + supplier-push logic lives in one place. Idempotent on the
// KoraPay reference — a replayed callback or a webhook that already created
// the order just returns the existing order.
//
// Returns a distinguishable "processing" state (retryable: true) when the
// charge hasn't flipped to success yet, so the client (PayResult) polls
// instead of showing a false failure.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const reference = String(body.reference || '').trim();
    if (!reference) return Response.json({ error: 'reference is required' }, { status: 400 });
    const om = body.order && typeof body.order === 'object' ? body.order : null;
    if (!om || !om.store_slug || !om.recipient_number || !om.network || om.volume_gb == null) {
      return Response.json({ error: 'Order details are required' }, { status: 400 });
    }

    const secret = secrets.get('KORAPAY_SECRET_KEY');
    if (!secret) return Response.json({ error: 'KoraPay is not configured yet' }, { status: 500 });
    const gmplKey = secrets.get('GMPL_API_KEY');
    const gmplBase = (secrets.get('GMPL_API_BASE') || 'https://getmorepaylessdatahouse.net').replace(/\/$/, '');

    const result = await finalizeStorefrontOrder(base44, reference, om, {
      korapaySecret: secret,
      gmplKey,
      gmplBase,
    });

    // Once the order exists, the pending meta stored at charge initialization
    // is no longer needed — clean it up so the webhook doesn't re-create.
    if (result.ok) {
      try {
        const rows = await base44.asServiceRole.entities.Setting.filter({ key: `korapay_pending:${reference}` }, '-created_date', 1);
        if (rows[0]) await base44.asServiceRole.entities.Setting.delete(rows[0].id);
      } catch {}
      return Response.json({
        ok: true,
        verified: true,
        order: result.order,
        provider: result.provider,
        duplicate: result.duplicate,
      });
    }

    // Transient "processing" state — client should retry.
    if (result.verified === false) {
      return Response.json({ verified: false, status: result.status, retryable: !!result.retryable });
    }

    // Hard failure (pricing / agent / amount mismatch).
    return Response.json({ error: result.error }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}