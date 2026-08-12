import React, { useEffect, useState } from "react";
import { format, subDays, isAfter } from "date-fns";
import { getAgentsFromSupabaseLive, getOrdersFromSupabase, getPackagesFromSupabase, getWalletTransactionsFromSupabase } from "@/lib/supabaseData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import RevenueGrowthReport from "@/components/analytics/RevenueGrowthReport";
import AgentLeaderboard from "@/components/analytics/AgentLeaderboard";
import BackendDiagnosticsPanel from "@/components/BackendDiagnosticsPanel";
import { buildBaseCostLookup, buildNetMarginLookup, isSupplierRefund, refundNet } from "@/lib/revenue";
import SupplierRefunds from "@/components/analytics/SupplierRefunds";

const cedi = (n) => `GH₵ ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Analytics() {
  const [orders, setOrders] = useState(null);
  const [agents, setAgents] = useState([]);
  const [packages, setPackages] = useState([]);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("all");
  const [gmplPricing, setGmplPricing] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [orderRows, agentRows, packageRows, walletTxRows] = await Promise.all([
        getOrdersFromSupabase(),
        getAgentsFromSupabaseLive().catch(() => []),
        getPackagesFromSupabase().catch(() => []),
        getWalletTransactionsFromSupabase().catch(() => []),
      ]);
      setOrders(orderRows);
      setAgents(agentRows || []);
      setPackages(packageRows || []);
      setWalletTransactions(walletTxRows || []);
      setGmplPricing([]);
    };

    load();
  }, []);

  if (!orders || !gmplPricing) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const baseCost = buildBaseCostLookup(packages);
  const netMargin = buildNetMarginLookup(packages, gmplPricing);
  const filteredOrders = selectedAgentId === "all"
    ? orders
    : orders.filter((o) => o.agent_id === selectedAgentId);
  const filteredWalletTransactions = selectedAgentId === "all"
    ? walletTransactions
    : walletTransactions.filter((t) => t.agent_id === selectedAgentId);

  const refundImpact = filteredOrders.filter(isSupplierRefund).reduce((s, o) => s + refundNet(o, netMargin), 0);
  const netProfit = filteredOrders.filter((o) => o.status === "completed").reduce((s, o) => s + netMargin(o), 0) + refundImpact;
  const grossRevenue = filteredOrders.filter((o) => o.status === "completed").reduce((s, o) => s + baseCost(o), 0);
  const pending = filteredOrders.filter((o) => o.status === "pending" || o.status === "processing").length;
  const gb = filteredOrders.filter((o) => o.status === "completed").reduce((s, o) => s + (o.volume_gb || 0), 0);
  const totalSales = filteredOrders.filter((o) => o.status === "completed").reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalDeposits = filteredWalletTransactions
    .filter((t) => ["top_up", "adjustment", "deposit"].includes(String(t.type || "").toLowerCase()))
    .reduce((s, t) => s + Math.max(Number(t.amount || 0), 0), 0);

  const days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));
  const chart = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const dayRefunds = filteredOrders
      .filter((o) => o.created_date && format(new Date(o.created_date), "yyyy-MM-dd") === key && isSupplierRefund(o))
      .reduce((s, o) => s + refundNet(o, netMargin), 0);
    const total = filteredOrders
      .filter((o) => o.created_date && format(new Date(o.created_date), "yyyy-MM-dd") === key && o.status === "completed")
      .reduce((s, o) => s + netMargin(o), 0) + dayRefunds;
    return { day: format(d, "MMM d"), total };
  });

  const weekAgo = subDays(new Date(), 7);
  const recentCount = filteredOrders.filter((o) => o.created_date && isAfter(new Date(o.created_date), weekAgo)).length;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="How the business is performing" />

      <div className="mb-4">
        <BackendDiagnosticsPanel autoRun intervalMs={60000} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <label htmlFor="agent-filter" className="text-xs uppercase tracking-widest text-muted-foreground">Filter analytics by agent</label>
        <select
          id="agent-filter"
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.full_name || agent.store_name || agent.email || agent.id}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Revenue" value={cedi(grossRevenue)} hint={`Net ${cedi(netProfit)} after cost`} />
        <StatCard label="Orders" value={filteredOrders.length} hint={`${recentCount} in last 7 days`} />
        <StatCard label="Pending" value={pending} hint="Awaiting delivery" />
        <StatCard label="Data sold" value={`${gb.toFixed(1)} GB`} />
        <StatCard label="Total sales" value={cedi(totalSales)} />
        <StatCard label="Total deposits" value={cedi(totalDeposits)} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Net profit · last 14 days</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--background))" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--secondary))" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--secondary))" width={40} />
              <Tooltip cursor={{ fill: "hsl(var(--card))" }} formatter={(v) => cedi(v)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <RevenueGrowthReport orders={orders} packages={packages} gmplPricing={gmplPricing} />

      <SupplierRefunds orders={orders} baseCost={baseCost} netMargin={netMargin} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AgentLeaderboard agents={agents} orders={orders} />

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Latest orders</p>
          {filteredOrders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          <div className="divide-y divide-border">
            {filteredOrders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="text-foreground">{o.recipient_number}</p>
                  <p className="text-xs text-muted-foreground">{o.package_name || `${o.volume_gb || "-"} GB`}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{cedi(o.amount)}</span>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}