import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { creditAgentWallet } from '../../shared/momo.ts';

// Lets a logged-in agent convert available commission into wallet balance so
// they can use it to order data (instead of withdrawing it to mobile money).
// Records a Withdrawal marked "paid" with method "wallet" so it reduces the
// agent's available commission, and credits the wallet via the shared helper.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const agents = await base44.asServiceRole.entities.Agent.filter({ email: user.email });
    const agent = agents && agents[0];
    if (!agent) return Response.json({ error: 'No agent account for this user' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return Response.json({ error: 'Enter a valid amount' }, { status: 400 });
    }

    // Paginate completed store orders past the 500-row cap so agents with a
    // long history have their full commission counted (a single 500-row fetch
    // would under-count and let them over-convert).
    let orders = [];
    let cursor = null;
    for (let i = 0; i < 20; i++) {
      const q = { agent_id: agent.id };
      if (cursor) q.created_date = { $lt: cursor };
      const batch = await base44.asServiceRole.entities.Order.filter(q, '-created_date', 500);
      orders = orders.concat(batch || []);
      if (!batch || batch.length < 500) break;
      cursor = batch[batch.length - 1].created_date;
    }
    const withdrawals = await base44.asServiceRole.entities.Withdrawal.filter({ agent_id: agent.id }, '-created_date', 500);

    const rate = Number(agent.commission_rate || 0);
    const earned = (orders || [])
      .filter((o) => o.status === 'completed' && o.source === 'store')
      .reduce((s, o) => s + Number(o.amount || 0), 0) * rate / 100;
    const reserved = (withdrawals || [])
      .filter((w) => w.status === 'pending')
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    const paid = (withdrawals || [])
      .filter((w) => w.status === 'paid')
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    const available = earned - reserved - paid;

    if (amount > available) {
      return Response.json(
        { error: `Only GH₵ ${available.toFixed(2)} of commission is available` },
        { status: 400 }
      );
    }

    const newBalance = await creditAgentWallet(base44, agent, amount, 'commission-conversion');

    await base44.asServiceRole.entities.Withdrawal.create({
      agent_id: agent.id,
      agent_name: agent.full_name,
      amount,
      method: 'wallet',
      account_info: 'Converted to wallet for orders',
      status: 'paid',
    });

    return Response.json({
      ok: true,
      amount,
      new_balance: newBalance,
      available: available - amount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}