const demoCollections = {
  orders: [
    {
      id: 'order-1',
      amount: 150,
      status: 'completed',
      source: 'store',
      created_date: '2026-08-11T10:43:13.275Z',
      package_name: 'Data bundle',
      recipient_number: '0244000000',
      network: 'MTN',
      volume_gb: 5,
      reference: 'demo-order-1',
    },
    {
      id: 'order-2',
      amount: 75,
      status: 'pending',
      source: 'store',
      created_date: '2026-08-11T10:43:13.275Z',
      package_name: 'Data bundle',
      recipient_number: '0244000001',
      network: 'AIRTELTIGO',
      volume_gb: 3,
      reference: 'demo-order-2',
    },
  ],
  agents: [
    {
      id: 'demo-agent',
      email: 'admin@example.com',
      full_name: 'Demo Admin',
      role: 'admin',
      store_name: 'Demo Store',
      commission_rate: 10,
      active: true,
    },
  ],
  packages: [
    {
      id: 'pkg-1',
      name: 'Data bundle',
      network: 'MTN',
      volume_gb: 5,
      agent_price: 4.5,
      active: true,
    },
    {
      id: 'pkg-2',
      name: 'Data bundle',
      network: 'AIRTELTIGO',
      volume_gb: 3,
      agent_price: 3.5,
      active: true,
    },
  ],
  agentPrices: [
    {
      id: 'ap-1',
      agent_id: 'demo-agent',
      package_id: 'pkg-1',
      price: 5.5,
      active: true,
    },
  ],
  reports: [
    {
      id: 'report-1',
      agent_id: 'demo-agent',
      order_id: 'order-1',
      status: 'resolved',
      created_date: '2026-08-11T10:43:13.275Z',
    },
  ],
  notifications: [
    {
      id: 'notif-1',
      active: true,
      title: 'Demo mode enabled',
      message: 'You are viewing the demo experience with local sample data.',
      created_date: '2026-08-11T10:43:13.275Z',
    },
  ],
  settings: [
    {
      id: 'setting-1',
      key: 'demo_mode',
      value: 'true',
    },
  ],
  chatMessages: [
    {
      id: 'chat-1',
      agent_id: 'demo-agent',
      sender: 'admin',
      read: true,
      text: 'Welcome to the demo workspace.',
      created_date: '2026-08-11T10:43:13.275Z',
    },
  ],
  agentWallets: [
    {
      id: 'wallet-1',
      agent_id: 'demo-agent',
      balance: 220,
      transactions: [
        {
          id: 'tx-topup-1',
          type: 'top_up',
          amount: 200,
          notes: 'Mobile money top-up',
          created_date: '2026-08-11T10:43:13.275Z',
          balance_after: 200,
        },
        {
          id: 'tx-adjustment-1',
          type: 'adjustment',
          amount: 20,
          notes: 'Commission converted to wallet',
          created_date: '2026-08-11T10:43:13.275Z',
          balance_after: 220,
        },
      ],
      momo_transactions: [
        {
          id: 'momo-1',
          transaction_id: 'MMO-1001',
          amount: 200,
          status: 'claimed',
          network: 'MTN',
          sender_number: '0244000000',
          created_date: '2026-08-11T10:43:13.275Z',
        },
      ],
      withdrawals: [
        {
          id: 'wd-1',
          amount: 25,
          method: 'momo',
          account_info: '0244000000',
          status: 'paid',
          created_date: '2026-08-11T10:43:13.275Z',
        },
        {
          id: 'wd-2',
          amount: 15,
          method: 'bank',
          account_info: '123456789',
          status: 'pending',
          created_date: '2026-08-11T10:43:13.275Z',
        },
      ],
    },
  ],
};

const normalizeCollectionName = (name) => {
  const normalized = String(name || '').toLowerCase();
  return {
    order: 'orders',
    orders: 'orders',
    agent: 'agents',
    agents: 'agents',
    package: 'packages',
    packages: 'packages',
    agentprice: 'agentPrices',
    agentprices: 'agentPrices',
    report: 'reports',
    reports: 'reports',
    notification: 'notifications',
    notifications: 'notifications',
    setting: 'settings',
    settings: 'settings',
    chatmessage: 'chatMessages',
    chatmessages: 'chatMessages',
    agentwallet: 'agentWallets',
    agentwallets: 'agentWallets',
  }[normalized] || normalized;
};

const matchesQuery = (record, query = {}) => {
  if (!query || typeof query !== 'object') return true;
  return Object.entries(query).every(([key, value]) => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'boolean') return Boolean(record?.[key]) === value;
    if (typeof value === 'object' && !Array.isArray(value)) {
      return record?.[key] != null && String(record[key]).toLowerCase() === String(value).toLowerCase();
    }
    return record?.[key] === value;
  });
};

export function queryDemoCollection(name, query = {}, sortField = '', limit = 100) {
  const collectionName = normalizeCollectionName(name);
  const items = (demoCollections[collectionName] || []).filter((item) => matchesQuery(item, query));
  const sorted = [...items].sort((a, b) => {
    const direction = String(sortField || '').startsWith('-') ? -1 : 1;
    const key = String(sortField || '').replace(/^[+-]/, '');
    const left = a?.[key];
    const right = b?.[key];
    if (left == null || right == null) return 0;
    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;
    return 0;
  });
  return sorted.slice(0, Number(limit || sorted.length || 100));
}

export function getDemoFunctionResult(name, payload = {}) {
  const normalized = String(name || '').toLowerCase();
  if (normalized === 'getgmplpricing') {
    return Promise.resolve({
      data: {
        pricing: [
          { network: 'MTN', volume_gb: 5, agentAmount: 3.2 },
          { network: 'AIRTELTIGO', volume_gb: 3, agentAmount: 2.4 },
        ],
      },
    });
  }
  if (normalized === 'ensureagentaccount') {
    return Promise.resolve({
      ok: true,
      agent: demoCollections.agents[0],
    });
  }
  if (normalized === 'pushordertogmpl') {
    return Promise.resolve({ ok: true, value: { ok: true } });
  }
  if (normalized === 'getpublicstore') {
    return Promise.resolve({ ok: true, data: { store: { id: 'demo-store', name: 'Demo Store' } } });
  }
  return Promise.resolve({ ok: true, data: payload || {} });
}
