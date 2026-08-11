// Shared wallet debit helper — deducts an amount from an agent's prepaid
// AgentWallet and records a WalletTransaction of type "debit". Returns the
// new balance, or null if the agent has no wallet to debit.
// Kept free of backend-runtime imports (uses the caller-supplied `base44`
// client) so it is safe to import from both backend functions and the client
// bundle.

export async function debitAgentWallet(base44, { agentId, agentName, amount, notes }) {
  const wallets = await base44.asServiceRole.entities.AgentWallet.filter({ agent_id: agentId }, '-created_date', 1);
  const w = wallets && wallets[0];
  if (!w) return null;
  // Atomic decrement: concurrent/bulk debits must not race on a stale balance read.
  await base44.asServiceRole.entities.AgentWallet.updateMany(
    { id: w.id },
    { $inc: { balance: -Number(amount) } }
  );
  // Re-read the committed balance to record an accurate balance_after snapshot.
  const refreshed = await base44.asServiceRole.entities.AgentWallet.filter({ agent_id: agentId }, '-created_date', 1);
  const bal = Number((refreshed && refreshed[0] && refreshed[0].balance) || 0);
  await base44.asServiceRole.entities.WalletTransaction.create({
    agent_id: agentId,
    agent_name: agentName || w.agent_name || '',
    type: 'debit',
    amount: Number(amount),
    balance_after: bal,
    notes,
  });
  return bal;
}