import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const toNumber = (value) => Number(value || 0);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!supabase) {
    res.status(200).json({ balance: 0, transactions: [], momo_transactions: [] });
    return;
  }

  const agentId = req.query.agentId || 'demo-agent';
  const { data, error } = await supabase.from('wallet_transactions').select('*').eq('agent_id', agentId).order('created_date', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const balance = (data || []).reduce((sum, item) => sum + toNumber(item.amount), 0);
  res.status(200).json({ balance, transactions: data || [], momo_transactions: [] });
}
