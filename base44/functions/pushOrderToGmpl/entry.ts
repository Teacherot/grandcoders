import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { pushOrderToProvider } from '../../shared/gmpl.ts';
import { getSetting } from '../../shared/settings.ts';

// Push a DataFlow Pro order to the GMPL provider API. Called from the app
// frontend (authenticated agent/admin) after a local Order is created.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const authed = await base44.auth.isAuthenticated();
    if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { orderId } = body;
    if (!orderId) {
      return Response.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Authorization: only the order's owner or an admin may push it to the supplier.
    const order = await base44.asServiceRole.entities.Order.get(orderId).catch(() => null);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    const isAdmin = user.role === 'admin';
    const isOwner = order.created_by_id === user.id;
    if (!isAdmin && !isOwner) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Manual delivery mode: leave the order pending for the admin to fulfill by hand.
    const auto = (await getSetting(base44, 'gmpl_auto_delivery', 'true')) !== 'false';
    if (!auto) return Response.json({ ok: false, skipped: true, status: 'pending', manual: true, message: 'Manual delivery enabled — order left pending' });

    // Use the stored order fields (not client-supplied) so a caller cannot redirect a supplier order.
    const apiKey = secrets.get('GMPL_API_KEY');
    const base = (secrets.get('GMPL_API_BASE') || 'https://getmorepaylessdatahouse.net').replace(/\/$/, '');
    const result = await pushOrderToProvider(base44, { apiKey, base, orderId, recipientNumber: order.recipient_number, network: order.network, volumeGb: order.volume_gb });
    // Every result from pushOrderToProvider is a handled outcome — success,
    // pending, awaiting stock, insufficient balance, or a provider rejection that
    // cancelled the order. Return 200 so the client can read the body and surface
    // the reason to the agent. Truly unexpected errors are caught below as 500.
    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}