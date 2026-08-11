// Shared MoMo top-up logic: credits an agent's wallet and records the
// WalletTransaction. Used by both the webhook (auto-claim by sender phone)
// and the manual claim function (agent enters the transaction ID).

// Normalise Ghanaian phone numbers to a comparable form (last 9 digits).
export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.slice(-9);
}

// Finds the agent whose registered phone matches the given number.
export async function findAgentByPhone(base44, phone) {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  const agents = await base44.asServiceRole.entities.Agent.filter({ status: 'active' }).catch(() => []);
  return (agents || []).find((a) => normalizePhone(a.phone) === norm) || null;
}

// Credits an agent's wallet, provisioning one if needed, and records the
// WalletTransaction. Returns the new balance.
export async function creditAgentWallet(base44, agent, amount, txnId) {
  let wallets = await base44.asServiceRole.entities.AgentWallet.filter({ agent_id: agent.id });
  let wallet = wallets && wallets[0];
  if (!wallet) {
    // Provision with a hashed key at rest. The plaintext is never returned
    // here; the agent reveals/regenerates it via the self-service endpoint.
    const { hashApiKey, genApiKey } = await import('./apikey.ts');
    wallet = await base44.asServiceRole.entities.AgentWallet.create({
      agent_id: agent.id,
      agent_name: agent.full_name,
      balance: 0,
      api_key: await hashApiKey(genApiKey()),
      api_key_created: new Date().toISOString(),
    });
  }
  // Atomic increment: concurrent claims (webhook auto-claim vs manual claim)
  // must not race on a stale balance read.
  await base44.asServiceRole.entities.AgentWallet.updateMany(
    { id: wallet.id },
    { $inc: { balance: Number(amount) } }
  );
  // Re-read the committed balance to record an accurate balance_after snapshot.
  const refreshed = await base44.asServiceRole.entities.AgentWallet.filter({ agent_id: agent.id });
  const newBalance = Number((refreshed && refreshed[0] && refreshed[0].balance) || 0);
  await base44.asServiceRole.entities.WalletTransaction.create({
    agent_id: agent.id,
    agent_name: agent.full_name,
    type: 'top_up',
    amount: Number(amount),
    balance_after: newBalance,
    notes: `MoMo top-up · Txn ${txnId}`,
  });
  return newBalance;
}