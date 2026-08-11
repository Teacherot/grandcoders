import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const toNumber = (value) => Number(value || 0);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!supabase) {
    res.status(200).json({ agentId: req.query.agentId || 'demo-agent', orders: [], withdrawals: [], walletData: { balance: 0, transactions: [], momo_transactions: [] } });
    return;
  }

  const agentId = req.query.agentId || 'demo-agent';
  const [ordersRes, withdrawalsRes, walletRes] = await Promise.all([
    supabase.from('orders').select('*').eq('agent_id', agentId).order('created_date', { ascending: false }),
    supabase.from('withdrawals').select('*').eq('agent_id', agentId).order('created_date', { ascending: false }),
    supabase.from('wallet_transactions').select('*').eq('agent_id', agentId).order('created_date', { ascending: false }),
  ]);

  if (ordersRes.error) {
    res.status(500).json({ error: ordersRes.error.message });
    return;
  }
  if (withdrawalsRes.error) {
    res.status(500).json({ error: withdrawalsRes.error.message });
    return;
  }
  if (walletRes.error) {
    res.status(500).json({ error: walletRes.error.message });
    return;
  }

  const walletTransactions = walletRes.data || [];
  const balance = walletTransactions.reduce((sum, item) => sum + toNumber(item.amount), 0);

  res.status(200).json({
    agentId,
    orders: ordersRes.data || [],
    withdrawals: withdrawalsRes.data || [],
    walletData: {
      balance,
      transactions: walletTransactions,
      momo_transactions: [],
    },
  });
}
