import { secrets } from 'base44:runtime';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const parseVol = (v) => {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  const m = String(v).trim().toLowerCase();
  const num = parseFloat(m);
  if (!isFinite(num)) return NaN;
  if (m.includes('mb')) return num / 1024;
  if (m.includes('gb')) return num;
  return num;
};

// Returns the GMPL supplier cost (agentAmount) per bundle so the admin can
// compute net revenue = (price charged to agent) − (GMPL cost). Admin-only.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const base = secrets.get('GMPL_API_BASE');
    const apiKey = secrets.get('GMPL_API_KEY');
    if (!base || !apiKey) {
      return Response.json({ error: 'Supplier not configured' }, { status: 503 });
    }
    const res = await fetch(`${base}/agent/bundles`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      return Response.json({ error: 'Could not reach supplier' }, { status: 502 });
    }
    const data = await res.json().catch(() => ({}));
    const bundles = Array.isArray(data)
      ? data
      : (data?.data?.data || data?.data || data?.bundles || []);
    const pricing = bundles.map((b) => ({
      network: String(b.network || b.provider || ''),
      volume_gb: parseVol(b.dataVolume ?? b.capacity ?? b.volumeGb ?? b.volume ?? b.size),
      gmpl_cost: Number(b.agentAmount ?? b.agentPrice ?? b.cost ?? b.wholesalePrice ?? 0),
    })).filter((p) => p.network && isFinite(p.volume_gb));
    return Response.json({ pricing });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}