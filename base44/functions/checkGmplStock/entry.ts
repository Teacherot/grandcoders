import { secrets } from 'base44:runtime';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getSetting } from '../../shared/settings.ts';

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

// Public storefront pre-check: is the requested bundle currently deliverable
// by the GMPL supplier (stock open)? Called BEFORE Paystack payment so a
// customer is never charged for a bundle that can't be fulfilled.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const network = String(body.network || '').trim();
    const volumeGb = Number(body.volume_gb);
    if (!network || !isFinite(volumeGb)) {
      return Response.json({ error: 'network and volume_gb are required' }, { status: 400 });
    }
    const base44 = createClientFromRequest(req);
    const auto = (await getSetting(base44, 'gmpl_auto_delivery', 'true')) !== 'false';
    if (!auto) return Response.json({ available: true, manual: true });

    const base = secrets.get('GMPL_API_BASE');
    const apiKey = secrets.get('GMPL_API_KEY');
    if (!base || !apiKey) {
      return Response.json({ available: false, reason: 'Service is not configured. Please try again later.' });
    }
    const res = await fetch(`${base}/agent/bundles`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      return Response.json({ available: false, reason: 'Could not reach the supplier. Please try again shortly.' });
    }
    const data = await res.json().catch(() => ({}));
    const bundles = Array.isArray(data)
      ? data
      : (data?.data?.data || data?.data || data?.bundles || []);
    const targetNet = network.toLowerCase();
    const match = bundles.find((b) => {
      const bNet = String(b.network || b.provider || '').toLowerCase();
      const bVol = parseVol(b.dataVolume ?? b.capacity ?? b.volumeGb ?? b.volume ?? b.size ?? b.amount);
      return bNet === targetNet && bVol === volumeGb;
    });
    if (!match) {
      return Response.json({ available: false, reason: 'This bundle is temporarily out of stock. Please try again later.' });
    }
    return Response.json({ available: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}