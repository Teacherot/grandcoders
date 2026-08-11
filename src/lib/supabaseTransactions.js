import { supabase } from '@/lib/supabaseClient';

export async function getTransactionsFromSupabase() {
  if (!supabase) return { wallet: [], momo: [] };

  const [walletRes, momoRes] = await Promise.all([
    supabase.from('wallet_transactions').select('*').order('created_date', { ascending: false }),
    supabase.from('orders').select('*').order('created_date', { ascending: false }),
  ]);

  if (walletRes.error) throw walletRes.error;
  if (momoRes.error) throw momoRes.error;

  return {
    wallet: walletRes.data || [],
    momo: (momoRes.data || []).map((item) => ({
      ...item,
      transaction_id: item.reference || item.id,
      sender_number: item.recipient_number,
      agent_name: item.agent_name || item.agent_email || '—',
      status: item.status === 'completed' ? 'claimed' : item.status,
    })),
  };
}
