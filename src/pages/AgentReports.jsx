import React, { useEffect, useState } from "react";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import { format } from "date-fns";
import ReportEvidence from "@/components/reports/ReportEvidence";
import { getReportsFromSupabase } from "@/lib/supabaseData";

const REPORT_STATUS_STYLE = {
  open: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300",
  reviewing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-amber-900 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300",
};

export default function AgentReports() {
  const { agent } = useRole();
  const [reports, setReports] = useState(null);

  useEffect(() => {
    if (!agent) return;
    getReportsFromSupabase()
      .then((rows) => setReports((rows || []).filter((r) => r.agent_id === agent.id)))
      .catch(() => setReports([]));
  }, [agent?.id]);

  if (!agent) return null;
  const list = reports || [];

  return (
    <div>
      <PageHeader title="My reports" subtitle="Order issues you've reported — admins review and resolve them here. Download any evidence the admin shares with you." />
      {!reports ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-sm text-muted-foreground">
          No reports yet. Report an issue from the My orders page on any completed order.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.package_name || "Bundle"} · {r.recipient_number}
                    {r.order_reference ? ` · ref ${r.order_reference}` : ""}
                  </p>
                  {r.details && <p className="text-sm text-muted-foreground mt-2">{r.details}</p>}
                  {r.resolution && <p className="text-sm text-foreground mt-2"><b>Resolution:</b> {r.resolution}</p>}
                  <ReportEvidence url={r.evidence_url} />
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] capitalize ${REPORT_STATUS_STYLE[r.status] || REPORT_STATUS_STYLE.open}`}>
                    {r.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-2">{r.created_date ? format(new Date(r.created_date), "MMM d, HH:mm") : ""}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}