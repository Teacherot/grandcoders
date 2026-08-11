import React from "react";
import { format } from "date-fns";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSupplierRefund, refundNet } from "@/lib/revenue";

const cedi = (n) => `GH₵ ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SupplierRefunds({ orders, baseCost, netMargin }) {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayRefunds = (orders || []).filter(
    (o) => isSupplierRefund(o) && o.created_date && format(new Date(o.created_date), "yyyy-MM-dd") === todayKey
  );
  const refundImpact = todayRefunds.reduce((s, o) => s + refundNet(o, netMargin), 0);

  function exportCsv() {
    const rows = [
      ["Time", "Order code", "Agent", "Recipient", "Package", "Network", "Amount", "Reimburse", "Reference"],
      ...todayRefunds.map((o) => [
        o.created_date ? format(new Date(o.created_date), "MMM d, yyyy HH:mm") : "",
        o.code || "",
        o.agent_name || "",
        o.recipient_number || "",
        o.package_name || "",
        o.network || "",
        o.amount || 0,
        baseCost(o),
        o.reference || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier-refunds-${todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Supplier refunds · today</p>
          <p className="text-sm text-muted-foreground mt-1">
            {todayRefunds.length} refunded order{todayRefunds.length === 1 ? "" : "s"} · {cedi(Math.abs(refundImpact))} to reimburse agents
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={todayRefunds.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>
      {todayRefunds.length === 0 ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <RotateCcw className="w-4 h-4" /> No supplier refunds today.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Recipient</th>
                <th className="py-2 pr-4 font-medium">Package</th>
                <th className="py-2 pr-4 font-medium">Agent</th>
                <th className="py-2 pr-4 font-medium text-right">Amount</th>
                <th className="py-2 pl-4 font-medium text-right">Reimburse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {todayRefunds.map((o) => (
                <tr key={o.id}>
                  <td className="py-2 pr-4 text-muted-foreground">{o.created_date ? format(new Date(o.created_date), "HH:mm") : "—"}</td>
                  <td className="py-2 pr-4">{o.recipient_number}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{o.package_name || `${o.volume_gb || "-"} GB`}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{o.agent_name || "—"}</td>
                  <td className="py-2 pr-4 text-right">{cedi(o.amount)}</td>
                  <td className="py-2 pl-4 text-right text-destructive font-medium">{cedi(baseCost(o))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}