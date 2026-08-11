import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { debitAgentWallet } from '../../shared/wallet.ts';

// Admin-only two-step withdrawal approval. Replaces the old auto-process
// workflow that debited the wallet the instant a request was created.
//   action: "approve"  — pending → approved (debits the agent wallet; rejects
//                        with a note if the balance can't cover the amount).
//                        Idempotent: an already-approved/paid request is a no-op.
//   action: "markPaid" — approved → paid. Idempotent if already paid.
//   action: "reject"   — pending → rejected (no wallet change). Only valid from
//                        "pending"; an already-approved request can't be
//                        rejected here (the wallet was already debited).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || body.withdrawal_id || '').trim();
    const action = String(body.action || '').trim();
    if (!id || !['approve', 'markPaid', 'reject'].includes(action)) {
      return Response.json({ error: 'id and action (approve|markPaid|reject) are required' }, { status: 400 });
    }

    const w = await base44.asServiceRole.entities.Withdrawal.get(id).catch(() => null);
    if (!w) return Response.json({ error: 'Withdrawal not found' }, { status: 404 });

    if (action === 'approve') {
      if (w.status === 'approved' || w.status === 'paid') {
        return Response.json({ ok: true, skipped: true, reason: `already ${w.status}` });
      }
      if (w.status !== 'pending') {
        return Response.json({ error: `Cannot approve a ${w.status} withdrawal` }, { status: 400 });
      }
      const amount = Number(w.amount || 0);
      if (amount <= 0) {
        await base44.asServiceRole.entities.Withdrawal.update(w.id, { status: 'rejected', notes: 'Invalid amount' });
        return Response.json({ ok: true, status: 'rejected', reason: 'invalid amount' });
      }
      const wallets = await base44.asServiceRole.entities.AgentWallet.filter({ agent_id: w.agent_id }, '-created_date', 1);
      const wallet = wallets && wallets[0];
      const balance = wallet ? Number(wallet.balance || 0) : 0;
      if (balance < amount) {
        await base44.asServiceRole.entities.Withdrawal.update(w.id, {
          status: 'rejected',
          notes: `Insufficient wallet balance (GH₵ ${balance.toFixed(2)} available)`,
        });
        return Response.json({ ok: true, status: 'rejected', balance, amount });
      }
      const newBalance = await debitAgentWallet(base44, {
        agentId: w.agent_id,
        agentName: w.agent_name || '',
        amount,
        notes: `Withdrawal approved · ${w.method || 'momo'}`,
      });
      await base44.asServiceRole.entities.Withdrawal.update(w.id, {
        status: 'approved',
        notes: `Approved — wallet debited, new balance GH₵ ${(newBalance ?? 0).toFixed(2)}`,
      });
      return Response.json({ ok: true, status: 'approved', balance: newBalance, amount });
    }

    if (action === 'markPaid') {
      if (w.status === 'paid') return Response.json({ ok: true, skipped: true, reason: 'already paid' });
      if (w.status !== 'approved') {
        return Response.json({ error: 'Only approved withdrawals can be marked paid' }, { status: 400 });
      }
      await base44.asServiceRole.entities.Withdrawal.update(w.id, { status: 'paid' });
      return Response.json({ ok: true, status: 'paid' });
    }

    // reject
    if (w.status !== 'pending') {
      return Response.json({ error: `Cannot reject a ${w.status} withdrawal` }, { status: 400 });
    }
    await base44.asServiceRole.entities.Withdrawal.update(w.id, {
      status: 'rejected',
      notes: body.notes || 'Rejected by admin',
    });
    return Response.json({ ok: true, status: 'rejected' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}