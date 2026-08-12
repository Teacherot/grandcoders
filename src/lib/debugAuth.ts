import { supabase } from './supabaseClient';

export async function debugAgentMapping() {
  const out: any = {
    step: 'start',
    userId: null,
    agent: null,
    errors: [],
  };

  if (!supabase) {
    out.errors.push({ step: 'init', message: 'Supabase is not configured' });
    return out;
  }

  // 1) current user
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    out.errors.push({ step: 'getUser', message: userErr.message });
    return out;
  }

  const user = userData.user;
  if (!user) {
    out.errors.push({ step: 'getUser', message: 'No authenticated user' });
    return out;
  }

  out.userId = user.id;
  out.step = 'user_loaded';

  // 2) try fetch matching agents row
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (agentErr) {
    out.errors.push({
      step: 'select_agents',
      message: agentErr.message,
      code: agentErr.code,
      details: agentErr.details,
      hint: agentErr.hint,
    });
    return out;
  }

  out.agent = agent;
  out.step = agent ? 'agent_found' : 'agent_not_found';
  return out;
}
