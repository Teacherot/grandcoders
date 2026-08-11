import { supabase } from '@/lib/supabaseClient';

function safeRows(result) {
  if (!result || result.error) return [];
  return result.data || [];
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

  const balance = tx.reduce((sum, row) => sum + Number(row.amount || 0), 0);

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
