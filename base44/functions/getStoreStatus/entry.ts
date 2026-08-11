import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Public endpoint (no auth) that exposes only the global "stores paused" flag.
// The Setting entity is admin-only, so the storefront and the agent store
// editor read the flag through here. Returns just a boolean — nothing sensitive.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const rows = await base44.asServiceRole.entities.Setting.filter({ key: 'stores_paused' });
    const paused = !!(rows && rows[0] && rows[0].value === 'true');
    return Response.json({ ok: true, stores_paused: paused });
  } catch (error) {
    return Response.json({ ok: false, stores_paused: false, error: error.message }, { status: 500 });
  }
}