import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function StoreWithdrawals({ agent }) {
  const [orders, setOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [walletData, setWalletData] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [form, setForm] = useState({ amount: "", method: "momo", account_info: "" });
  const [converting, setConverting] = useState(false);

  const load = async () => {
    const [o, w] = await Promise.all([
      base44.entities.Order.filter({ agent_id: agent.id }, "-created_date", 500),
      base44.entities.Withdrawal.filter({ agent_id: agent.id }, "-created_date", 100),
    ]);
    setOrders(o);
    setWithdrawals(w);
  };

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const res = await base44.functions.invoke("agentSelfService", {});
      setWalletData(res?.data || null);
    } catch (error) {
      console.error("Could not load wallet balance", error);
    } finally {
      setWalletLoading(false);
    }
  };

  const reloadWithdrawals = async () =>
    setWithdrawals(await base44.entities.Withdrawal.filter({ agent_id: agent.id }, "-created_date", 100));

  useEffect(() => {
    load();
    loadWallet();

    // Live-update the lists so the agent sees balance and payout status change
    // as orders are placed and admin actions are completed.
    const unsubOrders = base44.entities.Order.subscribe(() => {
      load();
      loadWallet();
    });
    const unsubWithdrawals = base44.entities.Withdrawal.subscribe(() => {
      reloadWithdrawals();
      loadWallet();
    });

    return () => {
      unsubOrders?.();
      unsubWithdrawals?.();
    };
  }, [agent.id]);

  const earned = orders.filter((o) => o.status === "completed" && o.source === "store").reduce((s, o) => s + (o.amount || 0), 0) * (agent.commission_rate || 0) / 100;
  const reserved = withdrawals.filter((w) => w.status === "pending").reduce((s, w) => s + (w.amount || 0), 0);
  const paid = withdrawals.filter((w) => w.status === "paid").reduce((s, w) => s + (w.amount || 0), 0);
  const available = earned - reserved - paid;
  const walletBalance = Number(walletData?.balance || 0);

  const request = async (e) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt > available) return;
    await base44.entities.Withdrawal.create({ agent_id: agent.id, agent_name: agent.full_name, amount: amt, method: form.method, account_info: form.account_info, status: "pending" });
    setForm({ amount: "", method: "momo", account_info: "" });
    load();
  };

  const convert = async () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0 || amt > available) return;
    setConverting(true);
    try {
      await base44.functions.invoke("convertCommissionToWallet", { amount: amt });
      toast({ title: "Commission converted", description: `GH₵ ${amt.toFixed(2)} moved to your wallet.` });
      setForm({ amount: "", method: "momo", account_info: "" });
      load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not convert", description: e?.response?.data?.error || e?.message || "Could not convert commission." });
    } finally {
      setConverting(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sel = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs uppercase tracking-widest text-muted-foreground">Earned</p><p className="text-2xl font-semibold mt-2 text-foreground">{cedi(earned)}</p></div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs uppercase tracking-widest text-muted-foreground">Paid out</p><p className="text-2xl font-semibold mt-2 text-foreground">{cedi(paid)}</p></div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-900 p-5"><p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Available</p><p className="text-2xl font-semibold mt-2 text-emerald-700 dark:text-emerald-400">{cedi(available)}</p></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Withdrawal history</p>
            <div className="rounded-full border border-sky-100 bg-sky-50/70 px-3 py-1.5 dark:border-sky-900 dark:bg-sky-950/30">
              <span className="text-[10px] uppercase tracking-widest text-sky-600 dark:text-sky-400">Wallet balance</span>
              <span className="ml-2 font-semibold text-sky-700 dark:text-sky-400">{walletLoading ? "—" : cedi(walletBalance)}</span>
            </div>
          </div>
          {withdrawals.length === 0 ? <p className="text-sm text-muted-foreground">No withdrawals yet.</p> : (
            <div className="divide-y divide-border">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between py-3 text-sm">
                  <div><p className="text-foreground">{cedi(w.amount)}</p><p className="text-xs text-muted-foreground">{w.method} · {w.account_info} · {w.created_date ? format(new Date(w.created_date), "MMM d, HH:mm") : ""}</p></div>
                  <StatusBadge status={w.status === "paid" ? "completed" : w.status === "approved" ? "processing" : w.status === "rejected" ? "failed" : "pending"} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <form onSubmit={request} className="rounded-2xl border border-border bg-card p-6 space-y-4 h-fit shadow-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Request payout</p>
        <div><Label>Amount (GH₵)</Label><Input type="number" step="0.01" max={available} required value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div>
        <div><Label>Method</Label><select className={sel} value={form.method} onChange={(e) => set("method", e.target.value)}><option value="momo">Mobile money</option><option value="bank">Bank</option><option value="cash">Cash</option></select></div>
        <div><Label>Account / number</Label><Input required value={form.account_info} onChange={(e) => set("account_info", e.target.value)} placeholder="0244..." /></div>
        <Button type="submit" className="w-full">Request withdrawal</Button>
        <p className="text-[11px] text-muted-foreground text-center">Requests are reviewed and approved by an admin before payout.</p>
        <div className="pt-4 mt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Or use your commission to buy data — it moves into your wallet balance.</p>
          <Button type="button" variant="outline" className="w-full" onClick={convert} disabled={converting || !Number(form.amount) || Number(form.amount) <= 0 || Number(form.amount) > available}>
            {converting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Converting…</> : "Use commission to order data"}
          </Button>
        </div>
      </form>
    </div>
  );
}