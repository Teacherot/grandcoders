import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { rateLimit } from '../../shared/ratelimit.ts';

// Public order-status lookup for a storefront. Given the short numeric order
// ID (the Order `code`), returns that single order's status/details. Runs as
// the service role to bypass the locked Order read RLS; because the code is
// unique, only the one order the customer placed is ever returned.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    const allowed = await rateLimit(base44, ip, 'storefront_check', 20, 10 * 60 * 1000);
    if (!allowed) return Response.json({ error: 'Too many lookups. Please wait a few minutes and try again.' }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!code) {
      return Response.json({ error: 'Order ID is required' }, { status: 400 });
    }
    const orders = await base44.asServiceRole.entities.Order.filter(
      { code },
      '-created_date',
      1
    );
    const order = (orders || [])[0];
    if (!order) {
      return Response.json({ orders: [] });
    }
    const safe = {
      id: order.id,
      code: order.code || '',
      package_name: order.package_name || '',
      network: order.network || '',
      amount: order.amount,
      recipient_number: order.recipient_number,
      status: order.status,
      created_date: order.created_date,
      evidence_url: order.evidence_url || '',
    };
    return Response.json({ orders: [safe] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}