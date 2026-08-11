import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { getSetting } from '../../shared/settings.ts';

// Polls the GMPL supplier for the delivery status of orders still marked
// "processing" and reconciles them to completed/failed. This is the reliable
// path because GMPL is not sending webhook callbacks. Runs on a schedule
// (every 10 minutes); no user auth, uses the service role.
//
// Two match paths:
//  - Direct: orders that already store gmpl_order_id (set on push) are fetched
//    by that id in a single call.
//  - Scan: orders without gmpl_order_id (created before this link existed) are
//    matched against recent GMPL orders' beneficiaries by recipient number +
//    data volume (NOT amount — our amount is the agent's sell price, GMPL's is
//    the supplier cost, so they legitimately differ). Once matched,
//    gmpl_order_id is stored so future runs use the direct path.
// Refunds/wallet credits are intentionally NOT applied here — supplier refunds
// are reconciled manually at end of business day.

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

// Normalize Ghana phone numbers to the last 9 digits so "0246849894",
// "233246849894" and "+233246849894" all collapse to "246849894".
const normPhone = (n) => String(n || '').replace(/\D/g, '').slice(-9);

const beneficiaryStatusToOrder = (bStatus) => {
  const s = String(bStatus || '').toLowerCase();
  if (['approved', 'fulfilled', 'completed', 'success', 'delivered'].includes(s)) return 'completed';
  if (['failed', 'declined', 'rejected', 'error'].includes(s)) return 'failed';
  return null; // pending / unknown -> leave as processing
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const apiKey = secrets.get('GMPL_API_KEY');
    const base = (secrets.get('GMPL_API_BASE') || 'https://getmorepaylessdatahouse.net').replace(/\/$/, '');
    if (!apiKey || !base) return Response.json({ ok: true, processed: 0, reason: 'Supplier not configured' });

    const auto = (await getSetting(base44, 'gmpl_auto_delivery', 'true')) !== 'false';
    if (!auto) return Response.json({ ok: true, processed: 0, manual: true, message: 'Manual delivery enabled — sync paused' });

    const processing = await base44.asServiceRole.entities.Order.filter({ status: 'processing' }, '-created_date', 300);
    if (!processing.length) return Response.json({ ok: true, processed: 0, reason: 'No processing orders' });

    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    const withId = processing.filter((o) => o.gmpl_order_id && /^ord_/.test(String(o.gmpl_order_id)));
    const withoutId = processing.filter((o) => !(o.gmpl_order_id && /^ord_/.test(String(o.gmpl_order_id))));

    let completed = 0, failed = 0, linked = 0, errors = 0;

    const apply = async (o, ns, gmplId) => {
      const update = {};
      if (ns) update.status = ns;
      if (gmplId && String(gmplId) !== String(o.gmpl_order_id || '')) update.gmpl_order_id = String(gmplId);
      if (Object.keys(update).length) {
        await base44.asServiceRole.entities.Order.update(o.id, update);
      }
      if (ns === 'completed') completed++;
      else if (ns === 'failed') failed++;
    };

    // Path A: direct fetch by stored gmpl_order_id.
    for (const o of withId) {
      try {
        const r = await fetch(`${base}/agent/orders/${o.gmpl_order_id}`, { headers });
        if (!r.ok) { errors++; continue; }
        const j = await r.json();
        const d = j?.data || j;
        const bens = Array.isArray(d?.beneficiaries) ? d.beneficiaries : [];
        const me = bens.find((b) => normPhone(b.phoneNumber) === normPhone(o.recipient_number));
        if (!me) continue;
        const ns = beneficiaryStatusToOrder(me.status);
        if (!ns) continue;
        await apply(o, ns, null);
      } catch { errors++; }
    }

    // Path B: scan recent GMPL orders, build a recipient index, match orders
    // without a stored gmpl_order_id.
    if (withoutId.length) {
      // Only look at GMPL orders created at/after our oldest processing order
      // (minus a 1h buffer) — older supplier orders can't contain these
      // pending orders, so skip them to keep the run fast.
      const minTs = processing.reduce((min, o) => {
        const t = o.created_date ? new Date(o.created_date).getTime() : Date.now();
        return t < min ? t : min;
      }, Date.now()) - 60 * 60 * 1000;

      let all = [];
      for (let page = 1; page <= 10; page++) {
        const r = await fetch(`${base}/agent/orders?page=${page}&limit=50`, { headers });
        const j = await r.json();
        const arr = j?.data?.data || j?.data || [];
        if (!arr.length) break;
        all = all.concat(arr);
        if (arr.length < 50) break;
        const oldest = Math.min(...arr.map((o) => (o.createdAt ? new Date(o.createdAt).getTime() : 0)));
        if (oldest && oldest < minTs) break; // assume newest-first listing
      }
      const recent = all.filter((o) => o.createdAt && new Date(o.createdAt).getTime() >= minTs);

      // idx: normalizedPhone -> [{ gOrder, b }]
      const idx = {};
      for (const go of recent) {
        try {
          const r = await fetch(`${base}/agent/orders/${go.id}`, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const d = j?.data || j;
          const bens = Array.isArray(d?.beneficiaries) ? d.beneficiaries : [];
          for (const b of bens) {
            const key = normPhone(b.phoneNumber);
            if (!key) continue;
            (idx[key] = idx[key] || []).push({ gOrder: go, b });
          }
        } catch { /* skip this order */ }
      }

      for (const o of withoutId) {
        try {
          const key = normPhone(o.recipient_number);
          const cands = idx[key] || [];
          if (!cands.length) continue;
          const vol = Number(o.volume_gb || 0);
          const volMatches = cands.filter((c) => parseVol(c.b.dataVolumeGb) === vol);
          if (!volMatches.length) continue;
          // Tiebreak: prefer the GMPL order created closest to our order's date.
          const ourTs = o.created_date ? new Date(o.created_date).getTime() : Date.now();
          let best = volMatches[0];
          let bestDelta = Math.abs((best.gOrder.createdAt ? new Date(best.gOrder.createdAt).getTime() : 0) - ourTs);
          for (const c of volMatches) {
            const ts = c.gOrder.createdAt ? new Date(c.gOrder.createdAt).getTime() : 0;
            const d = Math.abs(ts - ourTs);
            if (d < bestDelta) { best = c; bestDelta = d; }
          }
          const ns = beneficiaryStatusToOrder(best.b.status);
          await apply(o, ns, best.gOrder.id);
          linked++;
        } catch { errors++; }
      }
    }

    return Response.json({ ok: true, processing: processing.length, withId: withId.length, withoutId: withoutId.length, linked, completed, failed, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}