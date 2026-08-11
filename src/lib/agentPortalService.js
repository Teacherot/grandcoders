import { supabase } from '@/lib/supabaseClient';

const toNumber = (value) => Number(value || 0);

async function getCurrentAgent() {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const authUser = userResult?.user;
  if (!authUser?.email) throw new Error('Signed-in user not found');

  const { data: agentRows, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('email', authUser.email)
    .limit(1);

  if (agentError) throw agentError;
  const agent = agentRows?.[0];
  if (!agent) throw new Error('Agent profile not found');
  return agent;
}

export async function getAgentPortalData() {
  const agent = await getCurrentAgent();

  const [walletTxRes, walletRes, settingsRes] = await Promise.all([
    supabase.from('wallet_transactions').select('*').eq('agent_id', agent.id).order('created_date', { ascending: false }).limit(200),
    supabase.from('agent_wallets').select('*').eq('agent_id', agent.id).order('created_date', { ascending: false }).limit(1),
    supabase.from('settings').select('*').in('key', ['admin_momo_number', 'admin_momo_name']).limit(50),
  ]);

  if (walletTxRes.error) throw walletTxRes.error;
  if (walletRes.error) throw walletRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const transactions = walletTxRes.data || [];
  const balance = transactions.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const wallet = walletRes.data?.[0] || null;
  const settings = settingsRes.data || [];

  return {
    ok: true,
    agent,
    balance,
    transactions,
    api_key: wallet?.api_key || '',
    api_key_masked: wallet?.api_key ? '' : 'dfp_••••••••••••',
    admin_momo_number: settings.find((s) => s.key === 'admin_momo_number')?.value || '',
    admin_momo_name: settings.find((s) => s.key === 'admin_momo_name')?.value || 'GrandCoders',
    agent_phone: agent.phone || '',
  };
}

export async function regenerateAgentApiKey() {
  const agent = await getCurrentAgent();
  const apiKey = `dfp_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

  const { data: existingRows, error: existingError } = await supabase
    .from('agent_wallets')
    .select('*')
    .eq('agent_id', agent.id)
    .order('created_date', { ascending: false })
    .limit(1);

  if (existingError) throw existingError;

  const existing = existingRows?.[0];
  if (existing?.id) {
    const { error } = await supabase.from('agent_wallets').update({ api_key: apiKey }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('agent_wallets').insert({
      id: `wallet-${Date.now()}`,
      agent_id: agent.id,
      agent_name: agent.full_name,
      balance: 0,
      api_key: apiKey,
      created_date: new Date().toISOString(),
    });
    if (error) throw error;
  }

  return getAgentPortalData();
}

export async function runWalletReconciliation() {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: transactions, error: txError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .order('created_date', { ascending: false })
    .limit(10000);

  if (txError) throw txError;

  const grouped = new Map();
  (transactions || []).forEach((row) => {
    const key = row.agent_id;
    grouped.set(key, (grouped.get(key) || 0) + toNumber(row.amount));
  });

  const corrected = [];
  for (const [agentId, total] of grouped.entries()) {
    const { data: rows, error } = await supabase
      .from('agent_wallets')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_date', { ascending: false })
      .limit(1);
    if (error) throw error;

    const row = rows?.[0];
    if (row?.id) {
      const prev = toNumber(row.balance);
      if (prev !== total) {
        corrected.push({
          agent_id: agentId,
          agent: row.agent_name || agentId,
          was: prev,
          now: total,
          delta: total - prev,
        });
      }
      const { error: updateError } = await supabase.from('agent_wallets').update({ balance: total }).eq('id', row.id);
      if (updateError) throw updateError;
    } else {
      const { error: createError } = await supabase.from('agent_wallets').insert({
        id: `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agent_id: agentId,
        agent_name: agentId,
        balance: total,
        created_date: new Date().toISOString(),
      });
      if (createError) throw createError;
      corrected.push({ agent_id: agentId, agent: agentId, was: 0, now: total, delta: total });
    }
  }

  return {
    scanned: grouped.size,
    corrected_count: corrected.length,
    corrected,
  };
}
