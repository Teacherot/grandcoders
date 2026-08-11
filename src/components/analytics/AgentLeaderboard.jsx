import React, { useMemo } from "react";
import { Trophy } from "lucide-react";

const cedi = (n) => `GH₵ ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const rankStyles = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-slate-200 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
];

export default function AgentLeaderboard({ agents, orders }) {
  const ranked = useMemo(() => {
    const rows = agents
      .map((a) => {
        const mine = orders.filter((o) => o.agent_id === a.id && o.status === "completed");
        const sales = mine.reduce((s, o) => s + (o.amount || 0), 0);
        const volume = mine.reduce((s, o) => s + (o.volume_gb || 0), 0);
        return { name: a.full_name, sales, volume, count: mine.length };
      })
      .filter((r) => r.sales > 0)
      .sort((x, y) => y.sales - x.sales)
      .slice(0, 8);
    const max = rows.length ? rows[0].sales : 0;
    return rows.map((r, i) => ({ ...r, rank: i + 1, pct: max ? (r.sales / max) * 100 : 0 }));
  }, [agents, orders]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="w-4 h-4 text-primary" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Sales leaderboard</p>
      </div>
      {ranked.length === 0 && <p className="text-sm text-muted-foreground">No completed sales yet.</p>}
      <div className="space-y-3">
        {ranked.map((r) => (
          <div key={r.name} className="flex items-center gap-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${rankStyles[r.rank - 1] || "bg-muted text-muted-foreground"}`}>
              {r.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                <span className="text-sm font-semibold text-foreground">{cedi(r.sales)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{r.volume.toFixed(1)} GB · {r.count} orders</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}