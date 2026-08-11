import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Ensures every non-admin user has an Agent record. A NEW account may only be
// provisioned with sign-up authorization: either a valid `signup_token` supplied
// now (the post-login token screen) or a pending SignupAuthorization previously
// recorded for this email (pre-authorized at the register step). Established
// agents (record already exists) and admins skip the gate. This is the
// server-side enforcement that a compromised/empty client gate cannot bypass —
// including direct Google sign-ups, which create the platform user first.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'admin') return Response.json({ ok: true, role: 'admin', agent: null });

    const agents = await base44.asServiceRole.entities.Agent.filter({ email: user.email });
    let agent = agents && agents[0];
    if (agent) return Response.json({ ok: true, role: 'agent', agent });

    const body = await req.json().catch(() => ({}));
    const suppliedToken = (body?.signup_token || '').trim();

    let authorized = false;
    if (suppliedToken) {
      const rows = await base44.asServiceRole.entities.Setting.filter({ key: 'signup_token' }, '-created_date', 1);
      const valid = ((rows && rows[0] && rows[0].value) || '').trim();
      authorized = !!valid && valid === suppliedToken;
    }
    if (!authorized) {
      const pending = await base44.asServiceRole.entities.SignupAuthorization.filter({ email: user.email }, '-created_date', 1);
      if (pending && pending.length > 0) {
        authorized = true;
        await base44.asServiceRole.entities.SignupAuthorization.delete(pending[0].id);
      }
    }
    if (!authorized) {
      return Response.json({ error: 'signup_required' }, { status: 403 });
    }

    const name = user.full_name || (user.email || 'agent').split('@')[0];
    agent = await base44.asServiceRole.entities.Agent.create({
      full_name: name,
      email: user.email,
      phone: '',
      store_name: `${name}'s Store`,
    });
    return Response.json({ ok: true, role: 'agent', agent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}