import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { safeEqual } from '../../shared/webhook.ts';

// Records a token-validated sign-up authorization for an email, so the user can
// be auto-provisioned as an agent on first login without re-entering the token.
// Called from the register page right before account creation (email + Google
// can't be pre-authorized, so Google users enter the token once on first login).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = (body?.token || '').trim();
    const email = (body?.email || '').trim().toLowerCase();
    if (!token || !email) return Response.json({ error: 'Token and email are required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.Setting.filter({ key: 'signup_token' }, '-created_date', 1);
    const valid = ((rows && rows[0] && rows[0].value) || '').trim();
    if (!valid || !safeEqual(valid, token)) return Response.json({ error: 'Invalid token code' }, { status: 401 });

    const existing = await base44.asServiceRole.entities.SignupAuthorization.filter({ email }, '-created_date', 1);
    if (!existing || existing.length === 0) {
      await base44.asServiceRole.entities.SignupAuthorization.create({ email });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}