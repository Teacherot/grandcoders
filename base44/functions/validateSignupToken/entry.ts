import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { safeEqual } from '../../shared/webhook.ts';

// Validates the token code a new sign-up must present before they can register.
// The valid code is stored by an admin in the Setting "signup_token". A blank
// setting means no valid token exists, so sign-up stays locked until one is set.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = (body?.token || '').trim();
    if (!token) return Response.json({ error: 'Token code is required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.Setting.filter({ key: 'signup_token' }, '-created_date', 1);
    const valid = ((rows && rows[0] && rows[0].value) || '').trim();
    if (!valid || !safeEqual(valid, token)) {
      return Response.json({ error: 'Invalid token code' }, { status: 401 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}