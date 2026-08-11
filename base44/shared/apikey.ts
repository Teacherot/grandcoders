// API key hashing + expiry helpers. Agent API keys are stored as SHA-256
// hashes at rest so a database leak never exposes a usable credential. The
// plaintext is shown to the agent exactly once (at generation) and never
// persisted. Kept free of backend-runtime imports so it's safe to import from
// both backend functions and (if ever needed) the client bundle.

const KEY_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Hash a plaintext API key to a 64-char lowercase hex string for storage.
export async function hashApiKey(plaintext) {
  const enc = new TextEncoder();
  const data = enc.encode(String(plaintext));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Generate a fresh plaintext API key (client-facing format).
export function genApiKey() {
  return `dfp_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

// A stored value is a valid hash if it's 64 lowercase hex chars. Old plaintext
// keys (dfp_...) or empty values fail this check, which lets the self-service
// endpoint detect and force-rotate legacy keys on next access (the deploy-time
// "clear all keys" effect without a migration script).
export function isHashedKey(stored) {
  return /^[a-f0-9]{64}$/.test(String(stored || ''));
}

export function keyExpiresAt(createdDate) {
  if (!createdDate) return null;
  const t = new Date(createdDate).getTime();
  if (!isFinite(t)) return null;
  return t + KEY_TTL_MS;
}

export function keyIsExpired(createdDate) {
  const exp = keyExpiresAt(createdDate);
  return exp != null && Date.now() > exp;
}

export { KEY_TTL_MS };