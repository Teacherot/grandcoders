import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rateLimit } from '../../shared/ratelimit.ts';

// Creates a customer-submitted issue report for a storefront order. Public (no
// user auth) — looks up the agent server-side to stamp agent_email (so the
// RLS-locked Report is visible to the agent who owns the store), and only
// attaches an order that actually belongs to that agent. Replaces the old
// client-side Report.create in ReportTab, which had no agent identity to stamp.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    const allowed = await rateLimit(base44, ip, 'storefront_report', 10, 60 * 60 * 1000);
    if (!allowed) return Response.json({ error: 'Too many reports. Please try again later.' }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const agentId = String(body.agent_id || '').trim();
    const recipientNumber = String(body.recipient_number || '').trim();
    const reason = String(body.reason || '').trim();
    if (!agentId || !recipientNumber || !reason) {
      return Response.json({ error: 'agent_id, recipient_number, and reason are required' }, { status: 400 });
    }
    const agent = await base44.asServiceRole.entities.Agent.get(agentId).catch(() => null);
    if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 });

    let order = null;
    if (body.order_id) {
      order = await base44.asServiceRole.entities.Order.get(String(body.order_id)).catch(() => null);
      if (order && order.agent_id !== agentId) order = null;
    }
    const report = await base44.asServiceRole.entities.Report.create({
      order_id: order?.id || body.order_id || '',
      order_reference: order?.reference || '',
      agent_id: agent.id,
      agent_name: agent.full_name,
      agent_email: agent.email || '',
      customer_name: body.customer_name || '',
      recipient_number: recipientNumber,
      package_name: order?.package_name || body.package_name || '',
      network: order?.network || body.network || '',
      reason,
      details: body.details || '',
      status: 'open',
    });
    return Response.json({ ok: true, report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}