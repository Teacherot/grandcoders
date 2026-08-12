import React, { useEffect, useState } from "react";
import { getAgentSelfServiceData } from "@/lib/agentSelfService";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isCreditTransaction(tx = {}) {
  const type = String(tx.type || tx.kind || "").toLowerCase();
  return type === "top_up" || type === "adjustment" || type === "deposit" || type === "credit";
}

function signedAmount(tx = {}) {
  const amount = Number(tx.amount || 0);
  if (Number.isNaN(amount)) return 0;
  if (typeof tx.balance_after !== "undefined" && tx.balance_after !== null) {
    return amount;
  }
  return isCreditTransaction(tx) ? amount : -Math.abs(amount);
}

export default function AgentWalletOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgentSelfServiceData()
      .then((res) => setData(res || null))
      .finally(() => setLoading(false));
  }, []);

  const wallet = data?.transactions || [];
  const balance = data?.balance || 0;
  const now = new Date();
  const spent = wallet.filter((t) => !isCreditTransaction(t)).map((t) => ({
    ...t,
    amount: Math.abs(Number(t.amount || 0)),
    date: new Date(t.created_date || ""),
  }));

  const walletFlow = wallet.reduce((sum, tx) => sum + signedAmount(tx), 0);

  const todaySpend = spent
    .filter((t) => isSameDay(t.date, now))
    .reduce((sum, t) => sum + t.amount, 0);

  const sevenDaySpend = spent
    .filter((t) => t.date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
    .reduce((sum, t) => sum + t.amount, 0);

  const approxBundles = balance ? Math.floor(balance / 4.4) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Wallet</span>
        </div>
        <div className="mt-3 font-display text-5xl font-bold tracking-tight text-foreground">{loading ? "—" : cedi(balance)}</div>
        <div className="mt-2 text-xs text-muted-foreground">Net flow: {loading ? "—" : cedi(walletFlow)} · Approx. {loading ? "—" : approxBundles} × MTN 1GB bundles</div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background/50 p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Today spend</div>
            <div className="mt-1 font-display font-semibold tabular-nums">{loading ? "—" : cedi(todaySpend)}</div>
          </div>
          <div className="rounded-xl bg-background/50 p-3">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">7-day spend</div>
            <div className="mt-1 font-display font-semibold tabular-nums">{loading ? "—" : cedi(sevenDaySpend)}</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Manual deposit claim</h2>
        <div className="mt-3 rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm">
          <div className="text-muted-foreground">Send Mobile Money to</div>
          <div className="mt-2 text-lg font-semibold tracking-tight">{data?.admin_momo_number || "Loading..."}</div>
          <div className="text-xs text-muted-foreground">{data?.admin_momo_name || "GrandCoders"}</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['₵100', '₵250', '₵500', '₵1000', '₵2500'].map((amount) => (
            <button key={amount} type="button" className="rounded-xl border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary/40">
              {amount}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">You can submit a claim below if automatic credit does not arrive.</p>
      </div>
    </div>
  );
}
