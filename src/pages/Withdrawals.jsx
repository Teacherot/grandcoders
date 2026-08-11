import React, { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import WithdrawalApprovals from "@/components/admin/WithdrawalApprovals";
import { format } from "date-fns";
import { Search, ArrowUpRight, Smartphone } from "lucide-react";
import { getTransactionsFromSupabase } from "@/lib/supabaseTransactions";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function Withdrawals() {
  const [wallet, setWallet] = useState(null);
  const [momo, setMomo] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    getTransactionsFromSupabase()
      .then((data) => {
        setWallet(data.wallet || []);
        setMomo(data.momo || []);
      })
      .catch(() => {
        setWallet([]);
        setMomo([]);
      });
  }, []);

  const filter = (list) => {
    const s = q.trim().toLowerCase();
    if (!s) return list || [];
    return (list || []).filter((x) =>
      String(x.agent_name || x.sender_name || x.sender_number || x.transaction_id || x.notes || "").toLowerCase().includes(s)
    );
  };

  const w = filter(wallet);
  const m = filter(momo);

  return (
    <div className="space-y-6">
      <PageHeader title="Withdrawals" subtitle="Agent payout requests and approval queue" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agent, phone, txn id…" className="pl-9" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            <p className="text-sm font-medium">Wallet transactions</p>
            <span className="ml-auto text-xs text-muted-foreground">{w.length}</span>
          </div>
          {!wallet ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : w.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records.</p>
          ) : (
            <div className="divide-y divide-border max-h-[480px] overflow-auto">
              {w.map((t) => {
                const credit = t.type === "top_up" || t.type === "adjustment";
                return (
                  <div key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium capitalize">
                        {t.type.replace("_", " ")} <span className="text-muted-foreground font-normal">· {t.agent_name || "—"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.created_date ? format(new Date(t.created_date), "MMM d, HH:mm") : ""}
                        {t.notes ? ` · ${t.notes}` : ""}
                      </p>
                    </div>
                    <span className={credit ? "text-emerald-600 font-medium" : "text-foreground"}>
                      {credit ? "+" : "−"}{cedi(t.amount)}
                    </span>
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
            <span className="ml-auto text-xs text-muted-foreground">{m.length}</span>
          </div>
          {!momo ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : m.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records.</p>
          ) : (
            <div className="divide-y divide-border max-h-[480px] overflow-auto">
              {m.map((x) => (
                <div key={x.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{x.transaction_id}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {x.created_date ? format(new Date(x.created_date), "MMM d, HH:mm") : ""}
                      {x.agent_name ? ` · ${x.agent_name}` : x.sender_number ? ` · from ${x.sender_number}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{cedi(x.amount)}</p>
                    <span className={`text-[11px] capitalize ${x.status === "claimed" ? "text-emerald-600" : "text-amber-600"}`}>{x.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WithdrawalApprovals />
    </div>
  );
}
