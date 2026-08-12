import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normalizeNetwork(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'mtn') return 'MTN';
  if (raw === 'telecel' || raw === 'vodafone') return 'Telecel';
  if (raw === 'airteltigo' || raw === 'airtel tigo' || raw === 'airtel_tigo') return 'AirtelTigo';
  return 'Other';
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function normalizeRow(input, index) {
  const id = input.id || `pkg-${Date.now()}-${index}`;
  const code = input.code || null;
  const name = String(input.name || input.package_name || '').trim();
  const network = normalizeNetwork(input.network);
  const volume_gb = toNumber(input.volume_gb, null);
  const price = toNumber(input.price, 0);
  const agent_price = input.agent_price == null ? null : toNumber(input.agent_price, null);
  const validity = input.validity || 'No expiry';
  const active = toBoolean(input.active, true);

  if (!name) {
    throw new Error(`Row ${index + 1}: missing name/package_name`);
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Row ${index + 1}: invalid price`);
  }

  return {
    id,
    code,
    name,
    network,
    volume_gb,
    price,
    agent_price,
    validity,
    active,
  };
}

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    fail('Usage: node scripts/import-packages-to-supabase.mjs <path-to-packages.json>');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) fail('Missing SUPABASE_URL (or VITE_SUPABASE_URL).');
  if (!serviceRoleKey) fail('Missing SUPABASE_SERVICE_ROLE_KEY.');

  const absoluteInput = path.isAbsolute(inputArg)
    ? inputArg
    : path.join(process.cwd(), inputArg);

  if (!fs.existsSync(absoluteInput)) {
    fail(`Input file not found: ${absoluteInput}`);
  }

  const rawText = fs.readFileSync(absoluteInput, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    fail(`Invalid JSON file: ${error.message}`);
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.data)
      ? parsed.data
      : null;

  if (!rows) {
    fail('JSON must be an array of packages or an object with a data array.');
  }

  const payload = rows.map((row, idx) => normalizeRow(row, idx));

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('packages')
    .upsert(payload, { onConflict: 'id' })
    .select('id, code, name');

  if (error) {
    fail(`Supabase upsert failed: ${error.message}`);
  }

  console.log(`Imported ${data?.length || payload.length} package rows into packages table.`);
}

main().catch((error) => {
  fail(`Import failed: ${error.message}`);
});
