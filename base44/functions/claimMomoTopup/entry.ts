import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { creditAgentWallet } from '../../shared/momo.ts';

// Lets a logged-in agent credit their wallet by claiming a pending MoMo
// transaction they sent to the admin's wallet. Any agent may claim any pending
// transaction (the sender number is not enforced), but the claim window is
// limited to 5 hours from when the payment was recorded. After 5 hours the
// transaction_id is nullified (prefixed) so it can never be claimed, and a
// transaction_id can only be used once: a successful claim also nullifies the
// id, so a second attempt with the same id finds no matching pending record.

const CLAIM_WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const agents = await base44.asServiceRole.entities.Agent.filter({ email: user.email });
    const agent = agents && agents[0];
    if (!agent) return Response.json({ error: 'No agent account for this user' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const txnId = String(body.transaction_id || '').trim();
    if (!txnId) {
      return Response.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const txns = await base44.asServiceRole.entities.MomoTransaction
      .filter({ transaction_id: txnId, status: 'pending' });
    const txn = txns && txns[0];
    if (!txn) {
      return Response.json(
        { error: 'No pending payment found for that transaction ID. It may have already been claimed, expired, or never received.' },
        { status: 404 }
      );
    }

    // 5-hour claim window: after it expires, nullify the transaction_id so it
    // can never be claimed, then reject this attempt.
    const age = txn.created_date ? Date.now() - new Date(txn.created_date).getTime() : 0;
    if (age > CLAIM_WINDOW_MS) {
      await base44.asServiceRole.entities.MomoTransaction.update(txn.id, {
        transaction_id: `expired:${txn.transaction_id}`,
        status: 'rejected',
      });
      return Response.json(
        { error: 'This payment is older than 5 hours and can no longer be claimed. Please contact support to reconcile it.' },
        { status: 410 }
      );
    }

    const amount = Number(txn.amount);
    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid transaction amount' }, { status: 400 });
    }

    const newBalance = await creditAgentWallet(base44, agent, amount, txnId);

    // Nullify the transaction_id (prefix it) AND mark claimed, so the id cannot
    // be used a second time — a repeat claim finds no matching pending record.
    await base44.asServiceRole.entities.MomoTransaction.update(txn.id, {
      transaction_id: `claimed:${txn.transaction_id}`,
      status: 'claimed',
      agent_id: agent.id,
      agent_name: agent.full_name,
    });

    return Response.json({ ok: true, amount, new_balance: newBalance });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}