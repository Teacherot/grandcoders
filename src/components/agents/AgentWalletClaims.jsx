import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { getAgentSelfServiceData } from "@/lib/agentSelfService";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

function statusLabel(status) {
  if (status === "claimed") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

export default function AgentWalletClaims() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgentSelfServiceData()
      .then((res) => setData(res || null))
      .finally(() => setLoading(false));
  }, []);

  const claims = data?.momo_transactions || [];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Your deposit claims</h2>
      <p className="mt-1 text-sm text-muted-foreground">Manual top-up events and claim status from your wallet history.</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading claims…</p>
      ) : claims.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No deposit claims recorded yet.</p>
      ) : (
        <div className="divide-y divide-border mt-6">
          {claims.map((claim) => (
            <div key={claim.id} className="flex items-center gap-4 px-1 py-4 text-sm">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${claim.status === "claimed" ? "bg-emerald-500/10 text-emerald-600" : claim.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                {claim.status === "claimed" ? "+" : claim.status === "rejected" ? "×" : "…"}
              </span>
              <div className="min-w-0">
                <p className="font-medium truncate">{cedi(claim.amount)} · {claim.transaction_id || claim.note || "Manual deposit"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {claim.created_date ? format(new Date(claim.created_date), "MMM d, HH:mm") : "Unknown time"}
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${claim.status === "claimed" ? "bg-emerald-500/10 text-emerald-600" : claim.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                  {statusLabel(claim.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
