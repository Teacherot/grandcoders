import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { getWithdrawalsFromSupabase, updateWithdrawalInSupabase } from "@/lib/supabaseData";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

// Admin-only two-step withdrawal approval panel. Lists pending + approved
// withdrawals with Approve / Reject / Mark Paid actions backed by the
// manageWithdrawal backend function. The auto-process workflow no longer
// debits on creation — an admin must approve (debit) then mark paid here.
export default function WithdrawalApprovals() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState("");

  const load = async () => {
    try {
      const list = await getWithdrawalsFromSupabase();
      setItems(list || []);
    } catch {
      setItems([]);
    }
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  const act = async (id, action) => {
    setBusy(`${id}:${action}`);
    try {
      const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "paid";
      const updated = await updateWithdrawalInSupabase(id, { status });
      toast({ title: `Withdrawal ${updated?.status || status}` });
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Action failed", description: e?.response?.data?.error || e?.message || "" });
    } finally {
      setBusy("");
    }
  };

  const pending = (items || []).filter((w) => w.status === "pending" || w.status === "approved");

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm font-medium">Withdrawal approvals</p>
        <span className="ml-auto text-xs text-muted-foreground">{pending.length} awaiting action</span>
      </div>
      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">No withdrawals awaiting approval.</p>
      ) : (
        <div className="divide-y divide-border">
          {pending.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {cedi(w.amount)} <span className="text-muted-foreground font-normal">· {w.agent_name || "—"}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {w.method} · {w.account_info || "—"} · {w.created_date ? format(new Date(w.created_date), "MMM d, HH:mm") : ""}
                  {w.notes ? ` · ${w.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={w.status === "approved" ? "processing" : "pending"} />
                {w.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => act(w.id, "approve")} disabled={!!busy}>
                      {busy === `${w.id}:approve` ? "…" : "Approve"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(w.id, "reject")} disabled={!!busy}>
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => act(w.id, "markPaid")} disabled={!!busy}>
                    {busy === `${w.id}:markPaid` ? "…" : "Mark paid"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}