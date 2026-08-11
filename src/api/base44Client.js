import { supabase } from '@/lib/supabaseClient';
import { queryDemoCollection, getDemoFunctionResult } from '@/lib/demoData';

const entityTableMap = {
  Agent: 'agents',
  Order: 'orders',
  Report: 'reports',
  Package: 'packages',
  WalletTransaction: 'wallet_transactions',
  AgentWallet: 'agent_wallets',
  Withdrawal: 'withdrawals',
  Notification: 'notifications',
  ChatMessage: 'chat_messages',
  Setting: 'settings',
  AgentPrice: 'agent_prices',
  MomoTransaction: 'momo_transactions',
};

const slugify = (s = '') => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sortSpec = (sortField = '-created_date') => {
  const field = String(sortField || '-created_date');
  const descending = field.startsWith('-');
  return { column: descending ? field.slice(1) : field, ascending: !descending };
};

const parseRequestBody = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value;
  return {};
};

async function queryRows(tableName, query = {}, sortField = '-created_date', limit = 500) {
  if (!supabase || !tableName) return [];
  const { column, ascending } = sortSpec(sortField);
  let request = supabase.from(tableName).select('*');
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      request = request.eq(k, v);
    }
  });
  const { data, error } = await request.order(column, { ascending }).limit(limit);
  if (error) {
    console.warn(`Supabase query failed for ${tableName}:`, error.message);
    return [];
  }
  return data || [];
}

async function getCurrentAgentProfile() {
  if (!supabase) return null;
  const { data: userResult } = await supabase.auth.getUser();
  const authUser = userResult?.user;
  if (!authUser?.email) return null;
  const { data, error } = await supabase.from('agents').select('*').eq('email', authUser.email).limit(1);
  if (error) return null;
  return data?.[0] || null;
}

async function getAgentWalletBalance(agentId) {
  if (!supabase || !agentId) return 0;
  const { data, error } = await supabase.from('wallet_transactions').select('amount').eq('agent_id', agentId);
  if (error) return 0;
  return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

async function entityList(entityName, sortField = '-created_date', limit = 100) {
  if (isDemoMode()) {
    return queryDemoCollection(String(entityName).toLowerCase(), {}, sortField, limit);
  }
  const tableName = entityTableMap[entityName];
  if (!tableName) return [];
  return queryRows(tableName, {}, sortField, limit);
}

async function entityFilter(entityName, query = {}, sortField = '-created_date', limit = 100) {
  if (isDemoMode()) {
    return queryDemoCollection(String(entityName).toLowerCase(), query || {}, sortField, limit);
  }
  const tableName = entityTableMap[entityName];
  if (!tableName) return [];
  return queryRows(tableName, query, sortField, limit);
}

async function entityGet(entityName, id) {
  if (!supabase) return null;
  const tableName = entityTableMap[entityName];
  if (!tableName || !id) return null;
  const { data, error } = await supabase.from(tableName).select('*').eq('id', id).limit(1);
  if (error) return null;
  return data?.[0] || null;
}

async function entityCreate(entityName, payload = {}) {
  if (!supabase) return payload;
  const tableName = entityTableMap[entityName];
  if (!tableName) return payload;
  const row = {
    id: payload.id || `${String(entityName).toLowerCase()}-${Date.now()}`,
    created_date: payload.created_date || new Date().toISOString(),
    created_at: payload.created_at || payload.created_date || new Date().toISOString(),
    ...payload,
  };
  const { data, error } = await supabase.from(tableName).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function entityUpdate(entityName, id, updates = {}) {
  if (!supabase) return { id, ...updates };
  const tableName = entityTableMap[entityName];
  if (!tableName) return { id, ...updates };
  const { data, error } = await supabase.from(tableName).update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function entityDelete(entityName, id) {
  if (!supabase) return { ok: true };
  const tableName = entityTableMap[entityName];
  if (!tableName) return { ok: true };
  const { error } = await supabase.from(tableName).delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

async function entityBulkUpdate(entityName, updates = []) {
  const tasks = (updates || []).map((item) => entityUpdate(entityName, item.id, item));
  await Promise.all(tasks);
  return { ok: true, count: tasks.length };
}

const entities = new Proxy({}, {
  get(_target, entityName) {
    if (typeof entityName !== 'string') return undefined;
    return {
      list: (sortField = '-created_date', limit = 100) => entityList(entityName, sortField, limit),
      filter: (query = {}, sortField = '-created_date', limit = 100) => entityFilter(entityName, query, sortField, limit),
      get: (id) => entityGet(entityName, id),
      create: (payload) => entityCreate(entityName, payload),
      update: (id, updates) => entityUpdate(entityName, id, updates),
      delete: (id) => entityDelete(entityName, id),
      bulkUpdate: (updates) => entityBulkUpdate(entityName, updates),
      subscribe: () => () => {},
    };
  },
});

const isDemoMode = () => {
  if (typeof window === 'undefined') return true;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0' || window.localStorage.getItem('demo_login') === 'true';
};

const safeInvoke = async (name, payload = {}) => {
  if (isDemoMode()) {
    return getDemoFunctionResult(name, payload);
  }

  if (!supabase) {
    return { data: { ok: false, error: 'Supabase is not configured.' } };
  }

  try {
    switch (name) {
      case 'agentSelfService': {
        const body = parseRequestBody(payload);
        const agent = await getCurrentAgentProfile();
        if (!agent) return { data: { ok: false, error: 'Agent profile not found.' } };

        if (body.action === 'regenerateKey') {
          const apiKey = `dfp_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
          const existing = await queryRows('agent_wallets', { agent_id: agent.id }, '-created_date', 1);
          if (existing[0]?.id) {
            await entityUpdate('AgentWallet', existing[0].id, { api_key: apiKey });
          } else {
            await entityCreate('AgentWallet', { agent_id: agent.id, agent_name: agent.full_name, balance: 0, api_key: apiKey });
          }
          return { data: { ok: true, api_key: apiKey } };
        }

        if (body.action === 'savePrice') {
          return { data: { ok: true } };
        }

        const balance = await getAgentWalletBalance(agent.id);
        const wallets = await queryRows('agent_wallets', { agent_id: agent.id }, '-created_date', 1);
        const settings = await queryRows('settings', {}, '-created_at', 500);
        const adminMomoNumber = settings.find((s) => s.key === 'admin_momo_number')?.value || '';
        const adminMomoName = settings.find((s) => s.key === 'admin_momo_name')?.value || 'GrandCoders';

        return {
          data: {
            ok: true,
            balance,
            admin_momo_number: adminMomoNumber,
            admin_momo_name: adminMomoName,
            agent_phone: agent.phone || '',
            api_key: wallets[0]?.api_key || '',
          },
        };
      }

      case 'claimMomoTopup':
        return { data: { ok: false, error: 'Manual transaction claims are not enabled on Supabase-only mode.' } };

      case 'pushOrderToGmpl': {
        const body = parseRequestBody(payload);
        if (body.orderId) {
          await entityUpdate('Order', body.orderId, { status: 'processing' });
        }
        return { data: { ok: true, status: 'processing' } };
      }

      case 'checkGmplStock':
        return { data: { available: true } };

      case 'initializeKorapayCharge':
        return { data: { ok: false, error: 'KoraPay checkout is not configured in Supabase-only mode.' } };

      case 'placeStorefrontOrder': {
        const body = parseRequestBody(payload);
        const order = body.order || {};
        const storeSlug = order.store_slug;
        const agents = await queryRows('agents', {}, '-created_at', 2000);
        const matched = agents.find((a) => slugify(a.store_slug || a.store_name || a.full_name) === slugify(storeSlug));
        if (!matched) return { data: { ok: false, error: 'Store not found.' } };
        const created = await entityCreate('Order', {
          agent_id: matched.id,
          agent_name: matched.full_name,
          agent_email: matched.email,
          package_name: order.package_name,
          network: order.network,
          volume_gb: order.volume_gb,
          amount: Number(order.amount || 0),
          recipient_number: order.recipient_number,
          customer_name: order.customer_name,
          source: 'store',
          status: 'pending',
          reference: body.reference || '',
          code: `O${Date.now().toString().slice(-6)}`,
        });
        return { data: { ok: true, order: created } };
      }

      case 'verifyStorefrontTransaction':
        return { data: { ok: false, verified: false, retryable: false, error: 'Transaction verification is not configured.' } };

      case 'checkStorefrontOrder': {
        const body = parseRequestBody(payload);
        const code = String(body.code || '').trim();
        if (!code) return { data: { ok: false, error: 'Order code is required.' } };
        const rows = await queryRows('orders', { code }, '-created_date', 1);
        if (!rows[0]) return { data: { ok: false, error: 'Order not found.' } };
        return { data: { ok: true, order: rows[0] } };
      }

      case 'placeStorefrontReport': {
        const body = parseRequestBody(payload);
        const created = await entityCreate('Report', {
          order_id: body.order_id,
          recipient_number: body.recipient_number || '',
          package_name: body.package_name || '',
          reason: body.reason || 'General issue',
          details: body.details || '',
          status: 'open',
        });
        return { data: { ok: true, report: created } };
      }

      case 'getStoreStatus': {
        const rows = await queryRows('settings', { key: 'stores_paused' }, '-created_at', 1);
        return { data: { stores_paused: rows[0]?.value === 'true' } };
      }

      case 'getPublicStore': {
        const body = parseRequestBody(payload);
        const wantedSlug = slugify(body.slug || '');
        const agents = await queryRows('agents', {}, '-created_at', 2000);
        const agent = agents.find((a) => slugify(a.store_slug || a.store_name || a.full_name) === wantedSlug && a.status !== 'inactive');
        if (!agent) return { data: null };
        const packages = await queryRows('packages', { active: true }, '-created_date', 2000);
        const prices = packages.map((p) => ({
          id: p.id,
          package_name: p.name || p.package_name || `${p.volume_gb || ''}GB`,
          network: p.network,
          volume_gb: p.volume_gb,
          price: Number(p.agent_price ?? p.price ?? 0),
        }));
        return { data: { agent, prices } };
      }

      case 'ensureAgentAccount':
        return { data: { ok: true } };

      case 'manageWithdrawal': {
        const body = parseRequestBody(payload);
        const withdrawalId = body.id;
        const action = body.action;
        const row = await entityGet('Withdrawal', withdrawalId);
        if (!row) return { data: { ok: false, error: 'Withdrawal not found.' } };
        if (action === 'approve') {
          const updated = await entityUpdate('Withdrawal', withdrawalId, { status: 'approved' });
          return { data: updated };
        }
        if (action === 'reject') {
          const updated = await entityUpdate('Withdrawal', withdrawalId, { status: 'rejected' });
          return { data: updated };
        }
        if (action === 'markPaid') {
          const updated = await entityUpdate('Withdrawal', withdrawalId, { status: 'paid' });
          return { data: updated };
        }
        return { data: { ok: false, error: 'Unsupported action.' } };
      }

      case 'getGmplPricing':
        return { data: { pricing: [] } };

      case 'reconcileWallets': {
        const tx = await queryRows('wallet_transactions', {}, '-created_date', 10000);
        const grouped = new Map();
        tx.forEach((row) => {
          const key = row.agent_id;
          grouped.set(key, (grouped.get(key) || 0) + Number(row.amount || 0));
        });
        const corrected = [];
        for (const [agentId, total] of grouped.entries()) {
          const existing = await queryRows('agent_wallets', { agent_id: agentId }, '-created_date', 1);
          if (existing[0]?.id) {
            const prev = Number(existing[0].balance || 0);
            if (prev !== total) corrected.push({ agent_id: agentId, was: prev, now: total, delta: total - prev, agent: existing[0].agent_name || agentId });
            await entityUpdate('AgentWallet', existing[0].id, { balance: total });
          } else {
            await entityCreate('AgentWallet', { agent_id: agentId, balance: total, agent_name: agentId });
            corrected.push({ agent_id: agentId, was: 0, now: total, delta: total, agent: agentId });
          }
        }
        return { data: { ok: true, scanned: grouped.size, corrected_count: corrected.length, corrected } };
      }

      default:
        return { data: { ok: false, error: `Function ${name} is not implemented in Supabase-only mode.` } };
    }
  } catch (error) {
    return { data: { ok: false, error: error?.message || 'Function invocation failed.' } };
  }
};

const auth = {
  async me() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  },
  async resetPasswordRequest(email) {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return { ok: true };
  },
  async resetPassword({ newPassword }) {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { ok: true };
  },
  async isAuthenticated() {
    if (!supabase) return false;
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  },
};

const integrations = {
  Core: {
    async UploadFile({ file }) {
      if (!file) throw new Error('No file provided');
      const file_url = URL.createObjectURL(file);
      return { file_url };
    },
  },
};

export const base44 = {
  entities,
  functions: {
    invoke: safeInvoke,
  },
  auth,
  integrations,
};
