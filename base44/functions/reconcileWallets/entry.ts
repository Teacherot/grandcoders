import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Recomputes every agent wallet balance from its WalletTransaction history and
// corrects any drift caused by race conditions in bulk debits (each debit once
// did a read-then-write, so concurrent orders overwrote each other's reduction).
// Expected balance = sum(top_up) - sum(debit) + sum(manual adjustments that are
// NOT themselves reconciliation corrections). When the wallet balance differs,
// it is set to the expected value and an "adjustment" WalletTransaction is
// logged for the audit trail. Invoked daily by the "Reconcile Wallets" workflow
// (no user context) — also reachable over HTTP, where logged-in non-admins are blocked.
const RECON_NOTE = "Reconciliation correction";
const round = (n) => Math.round(Number(n) * 100) / 100;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const wallets = await base44.asServiceRole.entities.AgentWallet.list("-created_date", 1000);
    const corrected = [];
    let scanned = 0;

    for (const w of wallets) {
      scanned++;
      const txns = await base44.asServiceRole.entities.WalletTransaction.filter({ agent_id: w.agent_id }, "created_date", 2000);
      let topUp = 0, debit = 0, manualAdj = 0;
      for (const t of txns) {
        if (t.type === "top_up") topUp += Number(t.amount || 0);
        else if (t.type === "debit") debit += Number(t.amount || 0);
        else if (t.type === "adjustment") {
          // Exclude prior reconciliation corrections from the expected balance —
          // they are fixes, not real money in/out. Everything else is a manual admin adjustment.
          const note = String(t.notes || "");
          if (!note.startsWith(RECON_NOTE)) manualAdj += Number(t.amount || 0);
        }
      }
      const expected = round(topUp - debit + manualAdj);
      const current = round(Number(w.balance || 0));
      if (expected !== current) {
        const delta = round(expected - current);
        try {
          await base44.asServiceRole.entities.AgentWallet.update(w.id, { balance: expected });
          await base44.asServiceRole.entities.WalletTransaction.create({
            agent_id: w.agent_id,
            agent_name: w.agent_name || "",
            type: "adjustment",
            amount: delta,
            balance_after: expected,
            notes: `${RECON_NOTE} (was ${current.toFixed(2)}, set to ${expected.toFixed(2)})`,
          });
          corrected.push({ agent: w.agent_name, agent_id: w.agent_id, was: current, now: expected, delta });
        } catch { /* keep going on per-wallet failure */ }
      }
    }

    return Response.json({ ok: true, scanned, corrected_count: corrected.length, corrected });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}