import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { pushOrderToProvider } from '../../shared/gmpl.ts';
import { hashApiKey, keyIsExpired } from '../../shared/apikey.ts';

// Public agent-facing API. Authenticated by the agent's x-api-key header
// (no app-user session), so all entity work uses the service role.
// Actions: "placeOrder" and "listOrders".
function genOrderCode() {
  return `O${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).toUpperCase().slice(2, 4)}`;
}

function serializeOrder(o) {
  return {
    id: o.id,
    code: o.code,
    recipient_number: o.recipient_number,
    network: o.network,
    package_name: o.package_name,
    volume_gb: o.volume_gb,
    amount: o.amount,
    status: o.status,
    reference: o.reference,
    created_date: o.created_date,
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return Response.json({ error: 'Missing x-api-key header' }, { status: 401 });

    // Keys are stored as SHA-256 hashes at rest; hash the incoming key and
    // match against the stored hash. Old plaintext keys (pre-hardening) are
    // never a valid hash, so they can't authenticate and must be regenerated.
    // A key that matches more than one wallet is a shared/duplicate key and is
    // rejected outright, so a single compromised key can't act for another agent.
    const keyHash = await hashApiKey(apiKey);
    const wallets = await base44.asServiceRole.entities.AgentWallet.filter({ api_key: keyHash });
    if (!wallets || wallets.length !== 1) {
      return Response.json({ error: 'Invalid or non-unique API key' }, { status: 401 });
    }
    const wallet = wallets[0];
    if (keyIsExpired(wallet.api_key_created)) {
      return Response.json({ error: 'API key expired. Regenerate it in the agent dashboard.' }, { status: 401 });
    }
    const agent = await base44.asServiceRole.entities.Agent.get(wallet.agent_id).catch(() => null);
    if (!agent) return Response.json({ error: 'Invalid API key' }, { status: 401 });
    if (agent.status !== 'active') return Response.json({ error: 'Agent account suspended' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    // Security audit log: every authenticated agent API call is recorded so
    // compromised-key abuse is detectable in platform logs.
    const clientIp = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    console.warn(JSON.stringify({ ts: new Date().toISOString(), event: 'agent_api', agent_id: agent.id, action, ip: clientIp }));

    if (action === 'placeOrder') {
      const { recipientNumber, network, volumeGb, customerName, paymentMethod } = body;
      if (!recipientNumber || !network || volumeGb == null) {
        return Response.json(
          { error: 'Missing required fields: recipientNumber, network, volumeGb' },
          { status: 400 }
        );
      }
      const pkgs = await base44.asServiceRole.entities.Package.filter({ network, active: true });
      const pkg = pkgs.find((p) => Number(p.volume_gb) === Number(volumeGb));
      if (!pkg) {
        return Response.json({ error: `No active package for ${network} ${volumeGb}GB` }, { status: 404 });
      }
      const prices = await base44.asServiceRole.entities.AgentPrice.filter({
        agent_id: agent.id,
        package_id: pkg.id,
      });
      const ap = prices[0];
      const basePrice = Number(pkg.agent_price ?? pkg.price);
      const rawAmount = ap?.price != null ? Number(ap.price) : basePrice;
      const amount = Number.isFinite(rawAmount) && rawAmount >= basePrice ? rawAmount : basePrice;

      // Anti-abuse: cap automated order placement. A compromised key cannot
      // spam orders faster than one per 3 seconds, limiting wallet drain.
      const recent = await base44.asServiceRole.entities.Order.filter({ agent_id: agent.id }, '-created_date', 1);
      const last = recent && recent[0];
      if (last && last.created_date && Date.now() - new Date(last.created_date).getTime() < 3000) {
        return Response.json({ error: 'Too many orders. Please wait a few seconds and retry.' }, { status: 429 });
      }

      const order = await base44.asServiceRole.entities.Order.create({
        code: genOrderCode(),
        customer_name: customerName || '',
        recipient_number: String(recipientNumber),
        network,
        package_name: pkg.name,
        volume_gb: pkg.volume_gb,
        amount: Number(amount) || 0,
        agent_id: agent.id,
        agent_name: agent.full_name,
        agent_email: agent.email || '',
        status: 'pending',
        payment_method: paymentMethod || 'momo',
      });

      // Best-effort push to the GMPL provider; the local order exists already.
      const gmplKey = secrets.get('GMPL_API_KEY');
      const gmplBase = (secrets.get('GMPL_API_BASE') || 'https://getmorepaylessdatahouse.net').replace(/\/$/, '');
      let provider = null;
      try {
        provider = await pushOrderToProvider(base44, {
          apiKey: gmplKey,
          base: gmplBase,
          orderId: order.id,
          recipientNumber: String(recipientNumber),
          network,
          volumeGb: pkg.volume_gb,
        });
      } catch (e) {
        provider = { ok: false, error: e.message };
      }

      const updated = await base44.asServiceRole.entities.Order.get(order.id);
      return Response.json({ ok: true, order: serializeOrder(updated), provider });
    }

    if (action === 'listOrders') {
      const limit = Math.min(Number(body.limit) || 50, 200);
      const orders = await base44.asServiceRole.entities.Order.filter(
        { agent_id: agent.id },
        '-created_date',
        limit
      );
      return Response.json({ ok: true, orders: orders.map(serializeOrder) });
    }

    if (action === 'getPackages') {
      const [pkgs, prices] = await Promise.all([
        base44.asServiceRole.entities.Package.filter({ active: true }),
        base44.asServiceRole.entities.AgentPrice.filter({ agent_id: agent.id }),
      ]);
      const byPkg = {};
      (prices || []).forEach((p) => { if (p.active) byPkg[p.package_id] = Number(p.price); });
      const packages = pkgs
        .map((p) => {
          const base = Number(p.agent_price ?? p.price);
          const custom = byPkg[p.id];
          const price = Number.isFinite(custom) && custom >= base ? custom : base;
          return {
            id: p.id,
            name: p.name,
            network: p.network,
            volume_gb: p.volume_gb,
            validity: p.validity || '',
            base_price: base,
            price,
          };
        })
        .sort((a, b) => (a.network || '').localeCompare(b.network || '') || (a.volume_gb || 0) - (b.volume_gb || 0));
      return Response.json({ ok: true, packages });
    }

    if (action === 'getBalance') {
      return Response.json({
        ok: true,
        balance: Number(wallet.balance) || 0,
        currency: 'GHS',
        agent: { id: agent.id, name: agent.full_name, status: agent.status },
      });
    }

    if (action === 'getOrderStatus') {
      const id = (body.orderId || body.id || '').toString().trim();
      const code = (body.code || '').toString().trim();
      if (!id && !code) {
        return Response.json({ error: 'Provide orderId or code.' }, { status: 400 });
      }
      let order = null;
      if (id) {
        order = await base44.asServiceRole.entities.Order.get(id).catch(() => null);
      }
      if (!order && code) {
        const matches = await base44.asServiceRole.entities.Order.filter({ code });
        order = matches && matches[0];
      }
      if (!order || order.agent_id !== agent.id) {
        return Response.json({ error: 'Order not found.' }, { status: 404 });
      }
      return Response.json({ ok: true, order: serializeOrder(order) });
    }

    return Response.json(
      { error: 'Unknown action. Use placeOrder, listOrders, getPackages, getBalance, or getOrderStatus.' },
      { status: 400 }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}