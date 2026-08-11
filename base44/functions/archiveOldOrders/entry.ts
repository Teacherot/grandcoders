import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Marks completed / failed / cancelled orders older than 7 days as archived,
// keeping the active Orders list lean. Invoked weekly by the
// "Archive Old Orders" workflow (no user context) — also reachable over HTTP,
// where logged-in non-admins are blocked.
const ARCHIVE_STATUSES = ["completed", "failed", "cancelled"];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    // Scheduled runs have no user and proceed. Direct HTTP hits by non-admins are blocked.
    if (user && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const candidates = await base44.asServiceRole.entities.Order.list("-created_date", 1000);
    const toArchive = candidates.filter((o) =>
      ARCHIVE_STATUSES.includes(o.status) &&
      !o.archived &&
      o.created_date &&
      new Date(o.created_date).getTime() < cutoff
    );
    const nowIso = new Date().toISOString();
    let count = 0;
    for (const o of toArchive) {
      try {
        await base44.asServiceRole.entities.Order.update(o.id, { archived: true, archived_date: nowIso });
        count++;
      } catch { /* keep going on per-record failure */ }
    }
    return Response.json({ ok: true, archived: count, scanned: candidates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}