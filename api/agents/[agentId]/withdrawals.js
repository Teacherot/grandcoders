import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (!supabase) {
    res.status(200).json({ ok: true, withdrawal: null });
    return;
  }

  const agentId = req.query.agentId || 'demo-agent';

  if (req.method === 'POST') {
    let body = {};
    try {
      body = req.body ? JSON.parse(req.body) : {};
    } catch {
      body = {};
    }

    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
      return;
    }

    const { data, error } = await supabase.from('withdrawals').insert({
      id: `wd-${Date.now()}`,
      agent_id: agentId,
      amount,
      method: body.method || 'momo',
      account_info: body.account_info || '',
      status: 'pending',
      created_date: new Date().toISOString(),
    }).select().single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true, withdrawal: data });
    return;
  }

  const { data, error } = await supabase.from('withdrawals').select('*').eq('agent_id', agentId).order('created_date', { ascending: false });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ withdrawals: data || [] });
}
