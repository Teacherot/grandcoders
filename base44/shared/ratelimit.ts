// Best-effort per-IP rate limiting for public backend functions. Uses a single
// Setting per scope holding a JSON map of { ip: { start, count } }, pruned of
// expired entries on each write. Backend functions are stateless so this is
// best-effort (a narrow race on concurrent reads can let one extra request
// through) — the goal is to stop brute-force/spam, not to be a hard gate.

export async function rateLimit(base44, ip, scope, max, windowMs) {
  if (!ip || ip === 'unknown') return true; // can't bucket unknown IPs — allow
  const key = `rl:${scope}`;
  const now = Date.now();
  let row = null;
  try {
    const rows = await base44.asServiceRole.entities.Setting.filter({ key }, '-created_date', 1);
    row = rows && rows[0];
  } catch { /* best-effort */ }
  let map = {};
  if (row) { try { map = JSON.parse(row.value) || {}; } catch {} }
  // Prune expired IPs so the map doesn't grow unbounded.
  for (const k of Object.keys(map)) {
    if (now - (map[k].start || 0) > windowMs) delete map[k];
  }
  let b = map[ip];
  if (!b) { b = { start: now, count: 1 }; map[ip] = b; }
  else if (now - b.start > windowMs) { b.start = now; b.count = 1; }
  else { b.count += 1; }
  const allowed = b.count <= max;
  try {
    const value = JSON.stringify(map);
    if (row) await base44.asServiceRole.entities.Setting.update(row.id, { value });
    else await base44.asServiceRole.entities.Setting.create({ key, value, label: `Rate limit ${scope}` });
  } catch { /* best-effort */ }
  return allowed;
}