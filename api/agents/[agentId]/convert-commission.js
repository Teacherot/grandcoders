import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, '..', '..', '..', 'data', 'backend-store.json');

function loadStore() {
  if (!fs.existsSync(dataFile)) {
    return { agents: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return { agents: {} };
  }
}

function createDefaultAgentState(agentId) {
  return {
    id: agentId,
    balance: 220,
    transactions: [],
    momo_transactions: [],
    withdrawals: [],
  };
}

function getAgentState(store, agentId) {
  if (!store.agents[agentId]) {
    store.agents[agentId] = createDefaultAgentState(agentId);
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
  }
  return store.agents[agentId];
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const store = loadStore();
  const agentId = req.query.agentId || 'demo-agent';
  const agentState = getAgentState(store, agentId);

  if (req.method === 'POST') {
    let body = {};
    try {
      body = req.body ? JSON.parse(req.body) : {};
    } catch {
      body = {};
    }
    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
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
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
    res.status(200).json({ ok: true, balance: newBalance });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
