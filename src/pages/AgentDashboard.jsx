import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import { Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NotificationsPopup from "@/components/agents/NotificationsPopup";
import MomoTopUp from "@/components/agents/MomoTopUp";
import AgentOrderForm from "@/components/agents/AgentOrderForm";
import BulkPasteOrders from "@/components/agents/BulkPasteOrders";
import { nextCode, nextCodes } from "@/lib/shortCode";
import { pushOrderToGmpl, getAgentBalance } from "@/lib/gmpl";
import { toast } from "@/components/ui/use-toast";
import { getBackendHealth } from "@/lib/backend-api";
import { testSupabaseConnection, getAgentsFromSupabase } from "@/lib/supabaseClient";
import { createOrderInSupabase, getOrdersFromSupabase, getPackagesFromSupabase } from "@/lib/supabaseData";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function AgentDashboard() {
  const { agent } = useRole();
  const [orders, setOrders] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [prices, setPrices] = useState([]);
  const [backendStatus, setBackendStatus] = useState(null);
  const [backendError, setBackendError] = useState("");

  useEffect(() => {
    if (!agent) return;

    let cancelled = false;

    const loadOrders = async () => {
      const rows = await getOrdersFromSupabase();
      if (!cancelled) setOrders((rows || []).filter((row) => row.agent_id === agent.id));
    };
    const loadAgents = async () => {
      try {
        const data = await getAgentsFromSupabase();
        if (!cancelled && data.length > 0) {
          const match = data.find((row) => row.id === agent.id || row.email === agent.email);
          if (match) {
            const merged = { ...agent, ...match };
            if (JSON.stringify(merged) !== JSON.stringify(agent)) {
              // keep the current UI state but expose the live agent row for future use
            }
          }
        }
      } catch {
        // ignore and keep using the existing agent object
      }
    };
    loadOrders();
    loadAgents();
    setWallet(null);
    getPackagesFromSupabase().then((rows) => {
      if (!cancelled) setPackages(rows || []);
    }).catch(() => {});
    setPrices([]);

    Promise.all([
      getBackendHealth().catch((error) => ({ service: "local", ok: false, error: error?.message || "Backend unavailable" })),
      testSupabaseConnection().catch((error) => ({ ok: false, reason: error?.message || "Supabase unavailable" })),
    ])
      .then(([health, supabaseResult]) => {
        if (cancelled) return;
        if (supabaseResult?.ok) {
          setBackendStatus({ service: "supabase", ok: true });
          setBackendError("");
        } else {
          setBackendStatus(health?.ok ? health : null);
          setBackendError(supabaseResult?.reason || health?.error || "Backend unavailable");
        }
      })
      .catch((error) => {
        if (!cancelled) setBackendError(error?.message || "Backend unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [agent?.id]);

  const reload = async () => {
    const rows = await getOrdersFromSupabase();
    setOrders((rows || []).filter((row) => row.agent_id === agent.id));
  };

  if (!agent) return null;
  const agentName = String(agent.full_name || agent.store_name || agent.email || "Agent");
  const firstName = agentName.split(" ")[0] || "Agent";
  const list = orders || [];
  const completed = list.filter((o) => o.status === "completed");
  const pending = list.filter((o) => ["pending", "processing"].includes(o.status));
  const commission = completed.filter((o) => o.source === "store").reduce((s, o) => s + (o.amount || 0), 0) * (agent.commission_rate || 0) / 100;
  const recent = list.slice(0, 6);

  const saveOrder = async (data) => {
    try {
      const balance = await getAgentBalance();
      if (balance < Number(data.amount || 0)) {
        toast({ title: "Insufficient wallet balance", description: `This order costs ${cedi(data.amount)} but your wallet has ${cedi(balance)}. Top up your wallet to place it.`, variant: "destructive" });
        return;
      }
      const o = await createOrderInSupabase({ ...data, agent_id: agent.id, agent_name: agent.full_name, agent_email: agent.email, code: await nextCode("Order", "O") });
      setOpen(false);
      const res = await pushOrderToGmpl(o);
      reload();
      if (res?.ok) toast({ title: "Order placed", description: `${o.package_name || "Bundle"} → ${o.recipient_number} is ${res.status}.` });
    } catch (e) {
      toast({ title: "Couldn't place order", description: String(e?.message || e), variant: "destructive" });
    }
  };
  const saveBulk = async (rows) => {
    try {
      const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const balance = await getAgentBalance();
      if (balance < total) {
        toast({ title: "Insufficient wallet balance", description: `These ${rows.length} order(s) cost ${cedi(total)} but your wallet has ${cedi(balance)}. Top up your wallet to place them.`, variant: "destructive" });
        return;
      }
      const codes = await nextCodes("Order", "O", rows.length);
      const created = await Promise.all(rows.map((r, i) => createOrderInSupabase({ ...r, agent_id: agent.id, agent_name: agent.full_name, agent_email: agent.email, code: codes[i] })));
      setBulkOpen(false);
      const results = await Promise.allSettled((Array.isArray(created) ? created : []).map(pushOrderToGmpl));
      reload();
      const okCount = results.filter((r) => r.value?.ok).length;
      if (okCount) toast({ title: `${okCount} order(s) placed`, description: "They're now being sent to the supplier." });
    } catch (e) {
      toast({ title: "Couldn't place orders", description: String(e?.message || e), variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title={`Hi, ${firstName}`}
        subtitle={agent.store_name ? `Your store: ${agent.store_name}` : "Manage your store, prices and payouts"}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}><ClipboardList className="w-4 h-4 mr-2" />Bulk purchase</Button>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />New order</Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${backendStatus ? "bg-emerald-50 text-emerald-700" : backendError ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
          {backendStatus ? `Backend online · ${backendStatus.service}` : backendError ? "Backend check unavailable" : "Checking backend…"}
        </div>
      </div>
      <NotificationsPopup />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 mb-8">
        <StatCard label="Total orders" value={list.length} />
        <StatCard label="Completed" value={completed.length} />
        <StatCard label="Pending" value={pending.length} />
        <StatCard label="Commission earned" value={cedi(commission)} />
        <button onClick={() => setTopUpOpen(true)} className="text-left">
          <StatCard label="Wallet balance" value={cedi(wallet?.balance)} hint="Tap to top up" />
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Recent orders</p>
          <Link to="/orders" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
        {!orders ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet — share your store link with customers.</p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{o.package_name || "Bundle"}</p>
                  <p className="text-xs text-muted-foreground">{o.recipient_number} · {o.created_date ? format(new Date(o.created_date), "MMM d, HH:mm") : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-foreground">{cedi(o.amount)}</span>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New order</DialogTitle></DialogHeader>
          <AgentOrderForm packages={packages} prices={prices} onSubmit={saveOrder} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bulk purchase</DialogTitle></DialogHeader>
          <BulkPasteOrders packages={packages} prices={prices} onSubmit={saveBulk} onCancel={() => setBulkOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Top up wallet</DialogTitle></DialogHeader>
          <MomoTopUp />
        </DialogContent>
      </Dialog>
    </div>
  );
}