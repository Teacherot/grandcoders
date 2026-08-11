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
  const now = new Date().toISOString();
  return {
    id: agentId,
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
  res.status(200).json({
    balance: agentState.balance || 0,
    transactions: agentState.transactions || [],
    momo_transactions: agentState.momo_transactions || [],
  });
}
