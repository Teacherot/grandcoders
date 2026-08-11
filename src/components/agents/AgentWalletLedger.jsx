import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function AgentWalletLedger() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions
      .invoke("agentSelfService", {})
      .then((res) => setData(res?.data || null))
      .finally(() => setLoading(false));
  }, []);

  const transactions = (data?.transactions || [])
    .map((t) => ({
      ...t,
      amount: Number(t.amount || 0),
      date: t.created_date ? new Date(t.created_date) : null,
    }))
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

  const currentBalance = Number(data?.balance || 0);
  let runningBalance = currentBalance;

  const rows = transactions.map((t) => {
    const after = runningBalance;
    const before = after - t.amount;
    runningBalance = before;
    return {
      ...t,
      after,
      before,
    };
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Wallet ledger</h2>
      <p className="mt-1 text-sm text-muted-foreground">Recent credits and debits from your wallet history.</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading ledger…</p>
      ) : transactions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No wallet ledger entries available.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="hidden md:table-cell px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance before</th>
                <th className="px-4 py-3 text-right">Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/10">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    <div>{t.date ? format(t.date, "MMM d, HH:mm") : "Unknown"}</div>
                    <div className="text-[11px] text-muted-foreground/70">{t.date ? `${Math.floor((Date.now() - t.date.getTime()) / 60000)}m ago` : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium capitalize">{t.type?.replace("_", " ") || "Transaction"}</span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-muted-foreground truncate max-w-[24rem]">
                    {t.notes || t.description || (t.type === "top_up" ? `Top-up transaction ${t.transaction_id || "#"}` : "Wallet update")}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${t.amount >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {t.amount >= 0 ? "+" : "−"}{cedi(Math.abs(t.amount))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground tabular-nums">{cedi(t.before)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{cedi(t.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
