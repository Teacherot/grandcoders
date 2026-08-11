import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { debitAgentWallet } from '../../shared/wallet.ts';

// Auto-processes a freshly-created Withdrawal request:
//  - If the agent's AgentWallet balance covers the amount → mark the request
//    "approved", debit the wallet, and record a WalletTransaction.
//  - Otherwise → mark it "rejected" and email the agent.
// Invoked by the "Process Withdrawal" workflow on Withdrawal creation, so it
// runs regardless of where the request was created. Uses asServiceRole so it
// can read/update the admin-only AgentWallet and Withdrawal records.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const withdrawalId = body.withdrawal_id || body.withdrawalId;
    if (!withdrawalId) {
      return Response.json({ error: 'withdrawal_id is required' }, { status: 400 });
    }

    const w = await base44.asServiceRole.entities.Withdrawal.get(withdrawalId).catch(() => null);
    if (!w) return Response.json({ error: 'Withdrawal not found' }, { status: 404 });

    // Only process requests that are still pending. Skip anything already
    // handled (e.g. the commission-conversion withdrawal is created as "paid").
    if (w.status && w.status !== 'pending') {
      return Response.json({ ok: true, skipped: true, reason: `already ${w.status}` });
    }

    const amount = Number(w.amount || 0);
    if (amount <= 0) {
      await base44.asServiceRole.entities.Withdrawal.update(w.id, {
        status: 'rejected',
        notes: 'Invalid amount',
      });
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
      try {
        const agent = await base44.asServiceRole.entities.Agent.get(w.agent_id).catch(() => null);
        if (agent?.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: agent.email,
            subject: 'Withdrawal request rejected — insufficient wallet balance',
            body: `Hi ${agent.full_name || ''},\n\nYour withdrawal request of GH₵ ${amount.toFixed(2)} was rejected because your wallet balance (GH₵ ${balance.toFixed(2)}) is less than the requested amount.\n\nTop up your wallet and submit a new request.\n\n— GrandCoders Bundle Ops`,
          });
        }
      } catch (_) { /* notification is best-effort */ }
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
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}