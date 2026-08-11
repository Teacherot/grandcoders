// Shared helpers for inbound payment/provider webhooks (gmplWebhook, korapayWebhook).
// Plain module — no Deno.serve — imported by backend functions that need
// payload-field picking, constant-time comparison, HMAC computation, and
// best-effort diagnostic capture of raw deliveries.

// Pick the first non-empty value for any of the given keys from an object.
export function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}

// Constant-time string comparison to avoid timing side-channels on signatures/tokens.
export function safeEqual(a, b) {
  const sa = String(a || '');
  const sb = String(b || '');
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return diff === 0;
}

// Compute HMAC-SHA256(secret, message) and return a lowercase hex digest.
export async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Build a best-effort diagnostic saver that upserts a Setting record keyed by
// `settingKey`, capturing the raw body + selected headers + any extra info.
// Used to diagnose a provider's exact payload/signature format when a delivery
// fails verification or arrives in an unexpected shape.
export function createDiagnosticSaver(base44, settingKey, settingLabel, headerNames = []) {
  return async function save(rawBody, req, info) {
    try {
      const headers = {};
      for (const h of headerNames) headers[h] = req.headers.get(h);
      const payload = JSON.stringify({
        ts: new Date().toISOString(),
        raw: rawBody,
        headers,
        ...info,
      });
      const existing = await base44.asServiceRole.entities.Setting.filter({ key: settingKey }, '-updated_date', 1);
      if (existing[0]) {
        await base44.asServiceRole.entities.Setting.update(existing[0].id, { value: payload });
      } else {
        await base44.asServiceRole.entities.Setting.create({ key: settingKey, value: payload, label: settingLabel });
      }
    } catch (_) { /* diagnostic is best-effort */ }
  };
}