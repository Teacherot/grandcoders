import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { pushOrderToProvider } from '../../shared/gmpl.ts';
import { getSetting } from '../../shared/settings.ts';

// Re-pushes orders that are still "pending" — usually because the GMPL
// supplier had stock closed — so that when stock reopens, verified orders
// process (and debit the wallet) and permanently-rejected ones are cancelled.
// Runs on a schedule; no user auth, uses the service role.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const apiKey = secrets.get('GMPL_API_KEY');
    const base = (secrets.get('GMPL_API_BASE') || 'https://getmorepaylessdatahouse.net').replace(/\/$/, '');

    const auto = (await getSetting(base44, 'gmpl_auto_delivery', 'true')) !== 'false';
    if (!auto) return Response.json({ ok: true, processed: 0, manual: true, message: 'Manual delivery enabled — auto-retry paused' });

    const pending = await base44.asServiceRole.entities.Order.filter({ status: 'pending' }, '-created_date', 200);

    // Skip orders created in the last 3 minutes so we don't race the initial
    // push that happens right when an agent/customer places the order.
    const cutoff = Date.now() - 3 * 60 * 1000;
    const eligible = pending.filter((o) => o.created_date && new Date(o.created_date).getTime() < cutoff);

    let processed = 0, accepted = 0, rejected = 0, awaiting = 0, errors = 0;
    for (const o of eligible) {
      processed++;
      try {
        const r = await pushOrderToProvider(base44, { apiKey, base, orderId: o.id, recipientNumber: o.recipient_number, network: o.network, volumeGb: o.volume_gb });
        if (r?.status === 'processing' || r?.status === 'completed') accepted++;
        else if (r?.status === 'cancelled' || r?.status === 'failed') rejected++;
        else if (r?.awaitingStock) awaiting++;
        else if (r?.skipped) { /* already finished */ }
      } catch {
        errors++;
      }
    }
    return Response.json({ ok: true, processed, accepted, rejected, awaitingStock: awaiting, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}