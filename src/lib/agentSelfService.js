import { supabase } from '@/lib/supabaseClient';

function safeRows(result) {
  if (!result || result.error) return [];
  return result.data || [];
}

function isCreditTransaction(row = {}) {
  const type = String(row.type || row.kind || "").toLowerCase();
  return type === "top_up" || type === "adjustment" || type === "deposit" || type === "credit";
}

function signedAmount(row = {}) {
  const amount = Number(row.amount || 0);
  if (Number.isNaN(amount)) return 0;
  if (typeof row.balance_after !== "undefined" && row.balance_after !== null) {
    return amount;
  }
  return isCreditTransaction(row) ? amount : -Math.abs(amount);
}

export async function getAgentSelfServiceData(agentId = null) {
  if (!supabase) {
    return {
      ok: false,
      balance: 0,
      transactions: [],
      momo_transactions: [],
      admin_momo_number: '',
      admin_momo_name: 'GrandCoders',
      agent_phone: '',
      api_key: '',
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData?.user;

  let profile = null;
  if (agentId) {
    const byId = await supabase.from('agents').select('*').eq('id', agentId).limit(1);
    profile = safeRows(byId)[0] || null;
  }

  if (!profile && authUser?.email) {
    const byEmail = await supabase.from('agents').select('*').eq('email', authUser.email).limit(1);
    profile = safeRows(byEmail)[0] || null;
  }

  const resolvedAgentId = profile?.id || agentId || authUser?.id || '';

  const [walletRes, momoRes, walletProfileRes] = await Promise.all([
    resolvedAgentId
      ? supabase.from('wallet_transactions').select('*').eq('agent_id', resolvedAgentId).order('created_date', { ascending: false }).limit(500)
      : Promise.resolve(null),
    resolvedAgentId
      ? supabase.from('momo_transactions').select('*').eq('agent_id', resolvedAgentId).order('created_date', { ascending: false }).limit(500)
      : Promise.resolve(null),
    resolvedAgentId
      ? supabase.from('agent_wallets').select('*').eq('agent_id', resolvedAgentId).limit(1)
      : Promise.resolve(null),
  ]);

  const tx = safeRows(walletRes);
  const momo = safeRows(momoRes);
  const walletProfile = safeRows(walletProfileRes)[0] || null;
  const lastBalanceAfter = [...tx].find((row) => row.balance_after !== undefined && row.balance_after !== null)?.balance_after;
  const walletProfileBalance = walletProfile?.balance;
  const balance = Number.isFinite(Number(walletProfileBalance))
    ? Number(walletProfileBalance)
    : Number.isFinite(Number(lastBalanceAfter))
      ? Number(lastBalanceAfter)
      : tx.reduce((sum, row) => sum + signedAmount(row), 0);

  return {
    ok: true,
    balance,
    transactions: tx,
    momo_transactions: momo,
    admin_momo_number: '',
    admin_momo_name: 'GrandCoders',
    agent_phone: profile?.phone || '',
    api_key: walletProfile?.api_key || '',
    agent: profile,
  };
}
