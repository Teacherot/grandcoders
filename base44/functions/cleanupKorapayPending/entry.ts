import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Scheduled cleanup of abandoned storefront-payment pending metadata.
// initializeKorapayCharge stores korapay_pending:<ref> Setting rows holding the
// order meta (recipient number, agent id) so the KoraPay webhook can create
// the order if the customer's browser never returns from hosted checkout. Once
// the order is created (or the charge fails) that meta is deleted — but a
// customer who abandons checkout with no succeeding webhook leaves the PII row
// behind forever. This daily sweep deletes rows older than 24h, and clears any
// stale korapay_lock:* creation locks older than 10 minutes.
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const LOCK_TTL_MS = 10 * 60 * 1000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = Date.now();
    let removed = 0;
    let scanned = 0;
    // Setting has no "starts-with" filter; page through recent rows and prune
    // by key prefix + age. korapay_pending rows are short-lived so a recent
    // window is enough to catch abandonments.
    const rows = await base44.asServiceRole.entities.Setting.list('-created_date', 500);
    for (const r of rows || []) {
      const k = String(r.key || '');
      const isPending = k.startsWith('korapay_pending:');
      const isLock = k.startsWith('korapay_lock:');
      if (!isPending && !isLock) continue;
      scanned++;
      const age = r.created_date ? now - new Date(r.created_date).getTime() : 0;
      const ttl = isPending ? PENDING_TTL_MS : LOCK_TTL_MS;
      if (age > ttl) {
        try { await base44.asServiceRole.entities.Setting.delete(r.id); removed++; } catch {}
      }
    }
    return Response.json({ ok: true, scanned, removed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}