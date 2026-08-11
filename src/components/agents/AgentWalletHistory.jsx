import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ArrowUpRight, Smartphone } from "lucide-react";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function AgentWalletHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions
      .invoke("agentSelfService", {})
      .then((res) => setData(res?.data || null))
      .finally(() => setLoading(false));
  }, []);

  const wallet = data?.transactions || [];
  const momo = data?.momo_transactions || [];
  const currentBalance = Number(data?.balance || 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            <p className="text-sm font-medium">Wallet history</p>
          </div>
          <div className="rounded-full border border-sky-100 bg-sky-50/70 px-3 py-1.5 text-sm font-semibold text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-400">
            {loading ? "—" : cedi(currentBalance)}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : wallet.length === 0 ? (
          <p className="text-sm text-muted-foreground">No wallet transactions yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {wallet.map((t) => {
              const credit = t.type === "top_up" || t.type === "adjustment";
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium capitalize">{t.type.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.created_date ? format(new Date(t.created_date), "MMM d, HH:mm") : ""}
                      {t.notes ? ` · ${t.notes}` : ""}
                    </p>
                    {typeof t.balance_after !== "undefined" && t.balance_after !== null ? (
                      <p className="mt-1 text-[11px] text-sky-600 dark:text-sky-400">
                        Balance: {cedi(t.balance_after)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span className={credit ? "text-emerald-600 font-medium" : "text-foreground"}>
                      {credit ? "+" : "−"}{cedi(t.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">MoMo top-up records</p>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : momo.length === 0 ? (
          <p className="text-sm text-muted-foreground">No MoMo top-ups recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {momo.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{m.transaction_id}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.created_date ? format(new Date(m.created_date), "MMM d, HH:mm") : ""}
                    {m.network ? ` · ${m.network}` : ""}
                    {m.sender_number ? ` · from ${m.sender_number}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{cedi(m.amount)}</p>
                  <span className={`text-[11px] capitalize ${m.status === "claimed" ? "text-emerald-600" : "text-amber-600"}`}>{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}