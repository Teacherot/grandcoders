import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Called by the "Process New Order" workflow shortly after a new Order is
// created (a wait lets the existing storefront/agent/API supplier push finish
// first). Marks a still-pending order "processing" — only clean pending
// orders (e.g. admin-created ones that aren't auto-pushed), never ones the
// supplier held for insufficient balance or stock — then emails the assigned
// agent. Skips held and terminal (cancelled/failed) orders so it never lies
// about state or interferes with the wallet debit / retry flow.
// No user auth: runs from a workflow, uses the service role.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.orderId;
    if (!orderId) return Response.json({ error: 'order_id is required' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(orderId).catch(() => null);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const held = /insufficient|awaiting supplier stock/i.test(order.reference || '');
    const cancelled = order.status === 'cancelled' || order.status === 'failed';

    let statusChanged = false;
    if (order.status === 'pending' && !held) {
      await base44.asServiceRole.entities.Order.update(orderId, { status: 'processing' });
      statusChanged = true;
    }

    let notified = false;
    if (order.agent_id && !held && !cancelled) {
      try {
        const agent = await base44.asServiceRole.entities.Agent.get(order.agent_id).catch(() => null);
        if (agent?.email) {
          const fulfilled = order.status === 'completed';
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: agent.email,
            subject: `New order ${order.code || orderId} ${fulfilled ? 'delivered' : 'received'}`,
            body: `Hi ${agent.full_name || ''},\n\nA new order has been ${fulfilled ? 'fulfilled' : 'received and is being processed'}.\n\nOrder: ${order.code || orderId}\nPackage: ${order.package_name || (order.volume_gb ? order.volume_gb + 'GB' : '—')}\nRecipient: ${order.recipient_number || '—'}\nAmount: GH₵ ${Number(order.amount || 0).toFixed(2)}\n\n— GrandCoders Bundle Ops`,
          });
          notified = true;
        }
      } catch (_) { /* notification is best-effort */ }
    }

    return Response.json({ ok: true, order_id: orderId, status_changed: statusChanged, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}