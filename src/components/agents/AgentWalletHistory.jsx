import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { getAgentSelfServiceData } from "@/lib/agentSelfService";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function AgentWalletHistory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgentSelfServiceData()
      .then((payload) => setData(payload || null))
      .catch(() => setData({ transactions: [], momo_transactions: [], balance: 0 }))
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
              const source = t.source || t.origin || (String(t.notes || "").toLowerCase().includes("store") ? "store" : "agent");
              const orderId = t.order_id || t.orderId || t.reference || null;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium capitalize">{credit ? "Credit" : "Debit"} · {String(t.type || "transaction").replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.created_date ? format(new Date(t.created_date), "MMM d, HH:mm") : ""}
                      {t.notes ? ` · ${t.notes}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground truncate">
                      Source: {source}
                      {orderId ? ` · Order: ${orderId}` : ""}
                      {t.agent_name ? ` · Agent: ${t.agent_name}` : ""}
                    </p>
                    {typeof t.balance_after !== "undefined" && t.balance_after !== null ? (
                      <p className="mt-1 text-[11px] text-sky-600 dark:text-sky-400">
                        Balance after: {cedi(t.balance_after)}
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
          <p className="text-sm font-medium">MoMo top-up history</p>
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
                    {m.reference ? ` · ref ${m.reference}` : ""}
                    {m.phone ? ` · ${m.phone}` : m.sender_number ? ` · ${m.sender_number}` : ""}
                    {m.agent_name ? ` · ${m.agent_name}` : ""}
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