// Tiny key/value settings store read by backend functions via the service
// role (so public functions can read too). `base44` is a client constructed
// by the caller.
export async function getSetting(base44, key, defaultValue = null) {
  const rows = await base44.asServiceRole.entities.Setting.filter({ key }, "-created_date", 1);
  const r = rows[0];
  return r ? r.value : defaultValue;
}

// Upsert a key/value setting using the service role (backend only). Used by
// automated processes that need to write settings without an admin session.
export async function setSetting(base44, key, value, label = null) {
  const rows = await base44.asServiceRole.entities.Setting.filter({ key }, "-created_date", 1);
  const r = rows[0];
  if (r) {
    await base44.asServiceRole.entities.Setting.update(r.id, { value, ...(label ? { label } : {}) });
    return r.id;
  }
  const created = await base44.asServiceRole.entities.Setting.create({ key, value, label: label || key });
  return created.id;
}