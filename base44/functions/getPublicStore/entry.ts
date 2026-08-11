import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Public storefront lookup. Returns ONE agent's public store profile + active
// prices by store slug. Runs as the service role so it bypasses the locked-down
// Agent/AgentPrice read RLS, and the response is trimmed to public store fields
// only (no commission_rate, notes, status, code, or email) — so a visitor can
// see only the one store they opened, never enumerate every agent.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const want = String(body.slug || '').toLowerCase().trim();
    if (!want) return Response.json({ error: 'slug is required' }, { status: 400 });

    const agents = await base44.asServiceRole.entities.Agent.list();
    const agent = agents.find((a) => (a.store_slug || slugify(a.full_name)) === want);
    if (!agent) return Response.json({ error: 'Store not found' }, { status: 404 });

    const prices = await base44.asServiceRole.entities.AgentPrice.filter({ agent_id: agent.id, active: true });
    const publicAgent = {
      id: agent.id,
      full_name: agent.full_name || '',
      phone: agent.phone || '',
      region: agent.region || '',
      store_name: agent.store_name || '',
      store_slug: agent.store_slug || slugify(agent.full_name),
      store_bio: agent.store_bio || '',
      store_notice: agent.store_notice || '',
      store_theme: agent.store_theme || '#1E6FE8',
      store_active: agent.store_active !== false,
      logo_url: agent.logo_url || '',
    };
    const publicPrices = (prices || [])
      // 1GB bundles are disabled storefront-wide — never list them, even if an
      // AgentPrice row is somehow still active.
      .filter((p) => p.active && p.price && Number(p.volume_gb) !== 1)
      .map((p) => ({ id: p.id, package_name: p.package_name, network: p.network, volume_gb: p.volume_gb, price: p.price }))
      .sort((a, b) => (a.volume_gb || 0) - (b.volume_gb || 0));
    return Response.json({ agent: publicAgent, prices: publicPrices });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}