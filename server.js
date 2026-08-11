import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, 'data', 'backend-store.json');
const port = Number(process.env.PORT || 3001);

function createDefaultAgentState(agentId) {
  const now = new Date().toISOString();
  return {
    id: agentId,
    name: 'Demo Agent',
    balance: 220,
    transactions: [
      {
        id: 'tx-topup-1',
        type: 'top_up',
        amount: 200,
        notes: 'Mobile money top-up',
        created_date: now,
        balance_after: 200,
      },
      {
        id: 'tx-adjustment-1',
        type: 'adjustment',
        amount: 20,
        notes: 'Commission converted to wallet',
        created_date: now,
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
        created_date: now,
      },
    ],
    orders: [
      {
        id: 'order-1',
        amount: 150,
        status: 'completed',
        source: 'store',
        created_date: now,
        package_name: 'Data bundle',
      },
      {
        id: 'order-2',
        amount: 75,
        status: 'pending',
        source: 'store',
        created_date: now,
        package_name: 'Data bundle',
      },
    ],
    withdrawals: [
      {
        id: 'wd-1',
        amount: 25,
        method: 'momo',
        account_info: '0244000000',
        status: 'paid',
        created_date: now,
      },
      {
        id: 'wd-2',
        amount: 15,
        method: 'bank',
        account_info: '123456789',
        status: 'pending',
        created_date: now,
      },
    ],
  };
}

function loadStore() {
  if (!fs.existsSync(dataFile)) {
    const initialStore = { agents: {} };
    saveStore(initialStore);
    return initialStore;
  }

  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    const fallbackStore = { agents: {} };
    saveStore(fallbackStore);
    return fallbackStore;
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function getAgentState(store, agentId) {
  if (!store.agents[agentId]) {
    store.agents[agentId] = createDefaultAgentState(agentId);
    saveStore(store);
  }
  return store.agents[agentId];
}

function calculateAvailable(agentState) {
  const earned = (agentState.orders || [])
    .filter((order) => order.status === 'completed' && order.source === 'store')
    .reduce((sum, order) => sum + Number(order.amount || 0), 0) * 0.1;
  const reserved = (agentState.withdrawals || [])
    .filter((withdrawal) => withdrawal.status === 'pending')
    .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0);
  const paid = (agentState.withdrawals || [])
    .filter((withdrawal) => withdrawal.status === 'paid')
    .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0);
  return earned - reserved - paid;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const store = loadStore();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'grandcoders-backend',
      status: 'healthy',
      message: 'Backend is running locally for the payout flow.',
    });
    return;
  }

  const match = url.pathname.match(/^\/api\/agents\/([^/]+)\/(payout-data|wallet-history|withdrawals|convert-commission)$/);
  if (!match) {
    sendJson(res, 404, { error: 'Route not found' });
    return;
  }

  const [, agentId, action] = match;
  const agentState = getAgentState(store, agentId);

  if (req.method === 'GET' && action === 'payout-data') {
    sendJson(res, 200, {
      agentId,
      orders: agentState.orders || [],
      withdrawals: agentState.withdrawals || [],
      walletData: {
        balance: agentState.balance || 0,
        transactions: agentState.transactions || [],
        momo_transactions: agentState.momo_transactions || [],
      },
    });
    return;
  }

  if (req.method === 'GET' && action === 'wallet-history') {
    sendJson(res, 200, {
      balance: agentState.balance || 0,
      transactions: agentState.transactions || [],
      momo_transactions: agentState.momo_transactions || [],
    });
    return;
  }

  if (req.method === 'POST' && action === 'withdrawals') {
    try {
      const body = await readJsonBody(req);
      const amount = Number(body.amount || 0);
      const method = body.method || 'momo';
      const accountInfo = body.account_info || '';

      if (!amount || amount <= 0) {
        sendJson(res, 400, { error: 'Amount must be greater than zero.' });
        return;
      }

      const withdrawal = {
        id: `wd-${Date.now()}`,
        amount,
        method,
        account_info: accountInfo,
        status: 'pending',
        created_date: new Date().toISOString(),
      };

      agentState.withdrawals = [...(agentState.withdrawals || []), withdrawal];
      saveStore(store);
      sendJson(res, 200, { ok: true, withdrawal });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Could not create withdrawal' });
    }
    return;
  }

  if (req.method === 'POST' && action === 'convert-commission') {
    try {
      const body = await readJsonBody(req);
      const amount = Number(body.amount || 0);
      const available = calculateAvailable(agentState);

      if (!amount || amount <= 0) {
        sendJson(res, 400, { error: 'Amount must be greater than zero.' });
        return;
      }

      if (amount > available) {
        sendJson(res, 400, { error: 'Amount exceeds available commission.' });
        return;
      }

      const previousBalance = Number(agentState.balance || 0);
      const newBalance = previousBalance + amount;
      agentState.balance = newBalance;
      agentState.transactions = [
        ...(agentState.transactions || []),
        {
          id: `tx-${Date.now()}`,
          type: 'adjustment',
          amount,
          notes: 'Commission converted to wallet',
          created_date: new Date().toISOString(),
          balance_after: newBalance,
        },
      ];
      saveStore(store);
      sendJson(res, 200, { ok: true, balance: newBalance });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Could not convert commission' });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Backend server listening on http://127.0.0.1:${port}`);
});
