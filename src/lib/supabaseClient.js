import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function testSupabaseConnection() {
  if (!supabase) return { ok: false, reason: 'missing-env' };

  const { error } = await supabase.from('agents').select('id').limit(1);
  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
}

export async function getAgentsFromSupabase() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
