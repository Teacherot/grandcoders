import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { hashApiKey, genApiKey, isHashedKey, keyExpiresAt, keyIsExpired } from '../../shared/apikey.ts';

// Agent self-service: lets a logged-in agent read their wallet balance, their
// API key (masked — the plaintext is shown only once at generation), recent
// wallet transactions, and regenerate the API key. The AgentWallet entity is
// admin-only, so the agent reads it through here. Keys are stored as SHA-256
// hashes at rest; a legacy plaintext key (pre-hardening) is force-rotated on
// first access so old keys can no longer authenticate.

function maskKey() {
  return 'dfp_••••••••••••';
}

function serializeTxn(t) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    balance_after: t.balance_after,
    notes: t.notes,
    created_date: t.created_date,
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const agents = await base44.asServiceRole.entities.Agent.filter({ email: user.email });
    const agent = agents && agents[0];
    if (!agent) return Response.json({ error: 'No agent account for this user' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    let wallets = await base44.asServiceRole.entities.AgentWallet.filter({ agent_id: agent.id });
    let wallet = wallets && wallets[0];
    let plaintextKey = null; // returned only on generation/rotation — never otherwise

    // Auto-provision a wallet + key on first access, OR force-rotate a legacy
    // plaintext key (pre-hardening) so old keys can't be used anymore. A stored
    // value is a valid key only if it's a 64-char SHA-256 hash; anything else
    // (dfp_... plaintext, empty) triggers a fresh hashed key, shown once.
    const needsNewKey = !wallet || !isHashedKey(wallet.api_key);
    if (!wallet) {
      plaintextKey = genApiKey();
      wallet = await base44.asServiceRole.entities.AgentWallet.create({
        agent_id: agent.id,
        agent_name: agent.full_name,
        balance: 0,
        api_key: await hashApiKey(plaintextKey),
        api_key_created: new Date().toISOString(),
      });
    } else if (needsNewKey) {
      plaintextKey = genApiKey();
      const hashed = await hashApiKey(plaintextKey);
      const nowIso = new Date().toISOString();
      await base44.asServiceRole.entities.AgentWallet.update(wallet.id, {
        api_key: hashed,
        api_key_created: nowIso,
      });
      wallet = { ...wallet, api_key: hashed, api_key_created: nowIso };
    }

    if (body.action === 'regenerateKey') {
      plaintextKey = genApiKey();
      const hashed = await hashApiKey(plaintextKey);
      const nowIso = new Date().toISOString();
      await base44.asServiceRole.entities.AgentWallet.update(wallet.id, {
        api_key: hashed,
        api_key_created: nowIso,
      });
      wallet = { ...wallet, api_key: hashed, api_key_created: nowIso };
    }

    // Agent self-service price editor save. Routed through here (instead of a
    // direct AgentPrice write) so the server can enforce storefront-wide rules
    // — in particular, 1GB bundles are disabled and an agent cannot create or
    // re-activate a price for a 1GB package.
    if (body.action === 'savePrice') {
      const { package_id, price, active } = body;
      if (!package_id) return Response.json({ error: 'package_id is required' }, { status: 400 });
      const pkgs = await base44.asServiceRole.entities.Package.filter({ id: package_id });
      const pkg = pkgs && pkgs[0];
      if (!pkg) return Response.json({ error: 'Package not found' }, { status: 404 });
      if (Number(pkg.volume_gb) === 1) {
        return Response.json({ error: '1GB bundles are no longer available on storefronts.' }, { status: 400 });
      }
      const base = Number(pkg.agent_price ?? pkg.price);
      const sell = Number(price);
      if (!Number.isFinite(sell) || sell < base) {
        return Response.json({ error: `Sell price can't be below the base price of GHS ${base.toFixed(2)}.` }, { status: 400 });
      }
      const payload = {
        agent_id: agent.id,
        agent_email: agent.email,
        package_id: pkg.id,
        package_name: pkg.name,
        network: pkg.network,
        volume_gb: pkg.volume_gb,
        base_price: base,
        price: sell,
        active: active !== false,
      };
      const existingRows = await base44.asServiceRole.entities.AgentPrice.filter({ agent_id: agent.id, package_id: pkg.id });
      const existing = existingRows && existingRows[0];
      let saved;
      if (existing) {
        await base44.asServiceRole.entities.AgentPrice.update(existing.id, payload);
        saved = { id: existing.id, ...payload };
      } else {
        saved = await base44.asServiceRole.entities.AgentPrice.create(payload);
      }
      return Response.json({ ok: true, price: saved });
    }

    const txns = await base44.asServiceRole.entities.WalletTransaction
      .filter({ agent_id: agent.id }, '-created_date', 20)
      .catch(() => []);

    const momoTxns = await base44.asServiceRole.entities.MomoTransaction
      .filter({ agent_id: agent.id }, '-created_date', 20)
      .catch(() => []);

    const expiresAt = keyExpiresAt(wallet.api_key_created);
    return Response.json({
      ok: true,
      agent_id: agent.id,
      balance: wallet.balance || 0,
      api_key_masked: maskKey(),
      api_key: plaintextKey, // one-time plaintext after generation; null otherwise
      api_key_expires_at: expiresAt,
      api_key_expired: keyIsExpired(wallet.api_key_created),
      transactions: (txns || []).map(serializeTxn),
      momo_transactions: (momoTxns || []).map((m) => ({
        id: m.id,
        transaction_id: m.transaction_id,
        amount: m.amount,
        sender_number: m.sender_number,
        sender_name: m.sender_name,
        network: m.network,
        status: m.status,
        created_date: m.created_date,
      })),
      agent_phone: agent.phone || '',
      admin_momo_number: secrets.get('ADMIN_MOMO_NUMBER') || '',
      admin_momo_name: secrets.get('ADMIN_MOMO_NAME') || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}