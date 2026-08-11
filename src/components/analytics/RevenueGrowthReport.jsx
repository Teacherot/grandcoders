import React, { useState, useMemo } from "react";
import { format, subDays, startOfMonth, subMonths } from "date-fns";
import { ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { buildNetMarginLookup, isSupplierRefund, refundNet } from "@/lib/revenue";

const cedi = (n) => `GH₵ ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RevenueGrowthReport({ orders, packages, gmplPricing }) {
  const [mode, setMode] = useState("day");

  const { series, totals } = useMemo(() => {
    const netMargin = buildNetMarginLookup(packages, gmplPricing);
    const completed = (orders || []).filter((o) => o.status === "completed" && o.created_date);
    const refunded = (orders || []).filter((o) => isSupplierRefund(o) && o.created_date);
    let buckets = [];
    if (mode === "day") {
      buckets = Array.from({ length: 30 }, (_, i) => {
        const d = subDays(new Date(), 29 - i);
        return { key: format(d, "yyyy-MM-dd"), label: format(d, "MMM d"), sort: d.getTime() };
      });
    } else {
      buckets = Array.from({ length: 12 }, (_, i) => {
        const d = subMonths(new Date(), 11 - i);
        const ds = startOfMonth(d);
        return { key: format(ds, "yyyy-MM"), label: format(ds, "MMM yy"), sort: ds.getTime() };
      });
    }
    const map = new Map(buckets.map((b) => [b.key, { ...b, bundles: 0, gb: 0, revenue: 0 }]));
    for (const o of completed) {
      const d = new Date(o.created_date);
      const key = mode === "day" ? format(d, "yyyy-MM-dd") : format(startOfMonth(d), "yyyy-MM");
      const b = map.get(key);
      if (!b) continue;
      b.bundles += 1;
      b.gb += Number(o.volume_gb || 0);
      b.revenue += netMargin(o);
    }
    for (const o of refunded) {
      const d = new Date(o.created_date);
      const key = mode === "day" ? format(d, "yyyy-MM-dd") : format(startOfMonth(d), "yyyy-MM");
      const b = map.get(key);
      if (!b) continue;
      b.revenue += refundNet(o, netMargin);
    }
    const series = [...map.values()].sort((a, b) => a.sort - b.sort);
    const totals = series.reduce(
      (acc, b) => ({ bundles: acc.bundles + b.bundles, gb: acc.gb + b.gb, revenue: acc.revenue + b.revenue }),
      { bundles: 0, gb: 0, revenue: 0 }
    );
    return { series, totals };
  }, [orders, packages, mode]);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Data bundles &amp; revenue growth</p>
          <p className="text-sm text-muted-foreground mt-1">{mode === "day" ? "Last 30 days" : "Last 12 months"}</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {[
            { id: "day", label: "Daily" },
            { id: "month", label: "Monthly" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === m.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Bundles sold</p>
          <p className="text-xl font-semibold mt-1">{totals.bundles.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Data sold</p>
          <p className="text-xl font-semibold mt-1">{totals.gb.toFixed(1)} GB</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Net revenue</p>
          <p className="text-xl font-semibold mt-1">{cedi(totals.revenue)}</p>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series}>
            <defs>
              <linearGradient id="revGrowth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--background))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--secondary))" />
            <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--secondary))" width={48} tickFormatter={(v) => `₵${v}`} />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--secondary))" width={32} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--card))" }}
              formatter={(v, name) => (name === "Revenue" ? cedi(v) : v)}
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="right" dataKey="bundles" name="Bundles" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={mode === "day" ? 14 : 36} />
            <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrowth)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}