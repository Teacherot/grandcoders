import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';

const toDateValue = (value) => value ?? new Date().toISOString();

async function readTable(tableName, orderBy = 'created_date', fallbackEntityName = null) {
  if (!supabase) {
    if (fallbackEntityName) {
      try {
        return await base44.entities[fallbackEntityName].list('-created_date', 500);
      } catch (error) {
        console.warn(`Base44 fallback failed for ${fallbackEntityName}:`, error);
      }
    }
    return [];
  }

  try {
    const { data, error } = await supabase.from(tableName).select('*').order(orderBy, { ascending: false });
    if (error) {
      console.warn(`Supabase ${tableName} read failed:`, error.message);
      return fallbackEntityName ? fallbackList(fallbackEntityName) : [];
    }
    return data || [];
  } catch (error) {
    console.warn(`Supabase ${tableName} read failed:`, error);
    return fallbackEntityName ? fallbackList(fallbackEntityName) : [];
  }
}

async function fallbackList(entityName, limit = 500) {
  try {
    return await base44.entities[entityName].list('-created_date', limit);
  } catch (error) {
    console.warn(`Base44 fallback failed for ${entityName}:`, error);
    return [];
  }
}

async function writeWithFallback(tableName, method, payload, id, fallbackEntityName) {
  if (!supabase) {
    if (method === 'create') return base44.entities[fallbackEntityName || 'Order'].create(payload);
    if (method === 'update') return base44.entities[fallbackEntityName || 'Order'].update(id, payload);
    if (method === 'delete') return base44.entities[fallbackEntityName || 'Order'].delete(id);
  }

  try {
    if (method === 'create') {
      const { data, error } = await supabase.from(tableName).insert(payload).select().single();
      if (error) throw error;
      return data;
    }

    if (method === 'update') {
      const { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

    if (method === 'delete') {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return { ok: true };
    }
  } catch (error) {
    console.warn(`Supabase ${tableName} ${method} failed, falling back to Base44:`, error.message);
    if (fallbackEntityName) {
      if (method === 'create') return base44.entities[fallbackEntityName].create(payload);
      if (method === 'update') return base44.entities[fallbackEntityName].update(id, payload);
      if (method === 'delete') return base44.entities[fallbackEntityName].delete(id);
    }
  }

  return null;
}

export async function getOrdersFromSupabase() {
  const rows = await readTable('orders', 'created_date', 'Order');
  if (rows.length > 0) {
    return rows.map((row) => ({
      ...row,
      created_date: row.created_date || row.created_at || toDateValue(row.created_date),
    }));
  }
  return [];
}

export async function createOrderInSupabase(payload) {
  const row = {
    id: payload.id || `order-${Date.now()}`,
    ...payload,
    created_date: payload.created_date || payload.created_at || new Date().toISOString(),
  };
  return writeWithFallback('orders', 'create', row, null, 'Order');
}

export async function updateOrderInSupabase(id, updates) {
  return writeWithFallback('orders', 'update', updates, id, 'Order');
}

export async function deleteOrderInSupabase(id) {
  return writeWithFallback('orders', 'delete', null, id, 'Order');
}

export async function getReportsFromSupabase() {
  const rows = await readTable('reports', 'created_date', 'Report');
  if (rows.length > 0) {
    return rows.map((row) => ({
      ...row,
      created_date: row.created_date || row.created_at || toDateValue(row.created_date),
    }));
  }
  return [];
}

export async function updateReportInSupabase(id, updates) {
  return writeWithFallback('reports', 'update', updates, id, 'Report');
}

export async function getPackagesFromSupabase() {
  return readTable('packages', 'created_date', 'Package');
}

export async function createPackageInSupabase(payload) {
  return writeWithFallback('packages', 'create', payload, null, 'Package');
}

export async function updatePackageInSupabase(id, updates) {
  return writeWithFallback('packages', 'update', updates, id, 'Package');
}

export async function deletePackageInSupabase(id) {
  return writeWithFallback('packages', 'delete', null, id, 'Package');
}

export async function bulkUpdatePackagesInSupabase(items) {
  if (!supabase) {
    return Promise.all(items.map((item) => base44.entities.Package.update(item.id, { active: item.active })));
  }

  const { error } = await supabase.from('packages').upsert(items.map((item) => ({ id: item.id, active: item.active })));
  if (error) throw error;
  return items;
}

export async function getAgentsFromSupabaseLive() {
  return readTable('agents', 'created_at', 'Agent');
}

function sanitizeAgentPayload(payload = {}) {
  const allowed = ['id', 'email', 'full_name', 'code', 'role', 'store_name', 'commission_rate', 'active', 'created_at', 'created_date'];
  const output = {};

  allowed.forEach((key) => {
    if (payload[key] !== undefined) {
      output[key] = payload[key];
    }
  });

  if (!output.id) {
    output.id = payload.id || `agent-${Date.now()}`;
  }

  if (!output.created_at) {
    output.created_at = new Date().toISOString();
  }

  if (!output.created_date) {
    output.created_date = output.created_at;
  }

  return output;
}

export async function createAgentInSupabase(payload) {
  return writeWithFallback('agents', 'create', sanitizeAgentPayload(payload), null, 'Agent');
}

export async function updateAgentInSupabase(id, updates) {
  return writeWithFallback('agents', 'update', sanitizeAgentPayload(updates), id, 'Agent');
}

export async function deleteAgentInSupabase(id) {
  return writeWithFallback('agents', 'delete', null, id, 'Agent');
}

export async function getAgentWalletsFromSupabase() {
  return readTable('agent_wallets', 'created_date', 'AgentWallet');
}

export async function createAgentWalletInSupabase(payload) {
  return writeWithFallback('agent_wallets', 'create', payload, null, 'AgentWallet');
}

export async function updateAgentWalletInSupabase(id, updates) {
  return writeWithFallback('agent_wallets', 'update', updates, id, 'AgentWallet');
}

export async function getNotificationsFromSupabase() {
  return readTable('notifications', 'created_date', 'Notification');
}

export async function createNotificationInSupabase(payload) {
  return writeWithFallback('notifications', 'create', payload, null, 'Notification');
}

export async function updateNotificationInSupabase(id, updates) {
  return writeWithFallback('notifications', 'update', updates, id, 'Notification');
}

export async function deleteNotificationInSupabase(id) {
  return writeWithFallback('notifications', 'delete', null, id, 'Notification');
}

export async function getChatMessagesFromSupabase() {
  return readTable('chat_messages', 'created_date', 'ChatMessage');
}

export async function createChatMessageInSupabase(payload) {
  return writeWithFallback('chat_messages', 'create', payload, null, 'ChatMessage');
}

export async function updateChatMessageInSupabase(id, updates) {
  return writeWithFallback('chat_messages', 'update', updates, id, 'ChatMessage');
}

export async function getSettingsFromSupabase() {
  const rows = await readTable('settings', 'created_at', 'Setting');
  return rows || [];
}

export async function saveSettingInSupabase(key, value, label) {
  if (!supabase) {
    return base44.entities.Setting.create({ key, value, label });
  }

  const { data: existingRows, error: selectError } = await supabase.from('settings').select('*').eq('key', key).limit(1);
  if (selectError) throw selectError;

  const row = (existingRows || [])[0];
  if (row) {
    const { data, error } = await supabase.from('settings').update({ value, label }).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('settings').insert({ id: `setting-${Date.now()}`, key, value, label }).select().single();
  if (error) throw error;
  return data;
}
