import { supabase } from '@/lib/supabaseClient';

const toNumber = (value) => Number(value || 0);

export async function getAgentPayoutData(agentId) {
  if (!supabase) {
    return {
      agentId,
      orders: [],
      withdrawals: [],
      walletData: { balance: 0, transactions: [], momo_transactions: [] },
    };
  }

  const [ordersRes, withdrawalsRes, walletRes] = await Promise.all([
    supabase.from('orders').select('*').eq('agent_id', agentId).order('created_date', { ascending: false }),
    supabase.from('withdrawals').select('*').eq('agent_id', agentId).order('created_date', { ascending: false }),
    supabase.from('wallet_transactions').select('*').eq('agent_id', agentId).order('created_date', { ascending: false }),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (withdrawalsRes.error) throw withdrawalsRes.error;
  if (walletRes.error) throw walletRes.error;

  const walletTransactions = walletRes.data || [];
  const balance = walletTransactions.reduce((sum, item) => sum + toNumber(item.amount), 0);

  return {
    agentId,
    orders: ordersRes.data || [],
    withdrawals: withdrawalsRes.data || [],
    walletData: {
      balance,
      transactions: walletTransactions,
      momo_transactions: [],
    },
  };
}

export async function createWithdrawal(agentId, payload) {
  if (!supabase) throw new Error('Supabase not configured');

  const amount = toNumber(payload.amount);
  const { data, error } = await supabase.from('withdrawals').insert({
    id: `wd-${Date.now()}`,
    agent_id: agentId,
    amount,
    method: payload.method || 'momo',
    account_info: payload.account_info || '',
    status: 'pending',
    created_date: new Date().toISOString(),
  }).select().single();

  if (error) throw error;
  return data;
}

export async function convertCommissionToWallet(agentId, payload) {
  if (!supabase) throw new Error('Supabase not configured');

  const amount = toNumber(payload.amount);
  const { data, error } = await supabase.from('wallet_transactions').insert({
    id: `tx-${Date.now()}`,
    agent_id: agentId,
    type: 'adjustment',
    amount,
    notes: 'Commission converted to wallet',
    balance_after: amount,
    created_date: new Date().toISOString(),
  }).select().single();

  if (error) throw error;
  return data;
}
