import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import NetworkBadge from "@/components/NetworkBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "@/components/ui/image";
import { Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "reviewing", label: "Reviewing" },
  { id: "resolved", label: "Resolved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [resolving, setResolving] = useState(null);
  const [newStatus, setNewStatus] = useState("completed");
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [rs, os] = await Promise.all([
      base44.entities.Report.list("-created_date", 200),
      base44.entities.Order.list("-created_date", 500),
    ]);
    setReports(rs);
    setOrders(os);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const orderFor = (r) => orders.find((o) => o.id === r.order_id || o.code === r.order_id || o.reference === r.order_id);
  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const counts = FILTERS.reduce((acc, f) => {
    acc[f.id] = f.id === "all" ? reports.length : reports.filter((r) => r.status === f.id).length;
    return acc;
  }, {});

  const pickFile = (r) => {
    setUploadingId(r.id);
    if (fileRef.current) fileRef.current.click();
  };

  const onFileChosen = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) { setUploadingId(null); return; }
    const r = reports.find((x) => x.id === uploadingId);
    if (!r) { setUploadingId(null); return; }
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Report.update(r.id, { evidence_url: file_url });
      const o = orderFor(r);
      if (o) await base44.entities.Order.update(o.id, { evidence_url: file_url });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingId(null);
    }
  };

  const removeEvidence = async (r) => {
    await base44.entities.Report.update(r.id, { evidence_url: "" });
    const o = orderFor(r);
    if (o) await base44.entities.Order.update(o.id, { evidence_url: "" });
    load();
  };

  const openResolve = (r) => {
    setResolving(r);
    setNewStatus("completed");
    setResolution(r.resolution || "");
  };
  const closeResolve = () => setResolving(null);

  const saveResolve = async () => {
    if (!resolving) return;
    setBusy(true);
    try {
      await base44.entities.Report.update(resolving.id, {
        status: "resolved",
        resolution,
        new_order_status: newStatus,
      });
      if (resolving.order_id && newStatus) {
        const target = orders.find((o) => o.id === resolving.order_id || o.code === resolving.order_id || o.reference === resolving.order_id);
        if (target) await base44.entities.Order.update(target.id, { status: newStatus });
      }
      await load();
      closeResolve();
    } finally {
      setBusy(false);
    }
  };

  const setReviewing = async (r) => {
    await base44.entities.Report.update(r.id, { status: "reviewing" });
    load();
  };

  return (
    <div>
      <PageHeader title="Reports desk" subtitle="Customer-reported order issues. Resolving updates the order status for the customer and agent." />

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              filter === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}{counts[f.id] ? ` · ${counts[f.id]}` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports here.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const o = orderFor(r);
            return (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="text-sm font-medium text-foreground">{r.reason}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.recipient_number} · {r.package_name || "no order linked"} · {when(r.created_date)}
                    </p>
                    {r.details && <p className="text-sm text-muted-foreground mt-2">{r.details}</p>}
                    {r.resolution && <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">Resolution: {r.resolution}</p>}
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Evidence · visible to agent & customer</p>
                      {r.evidence_url ? (
                        <div className="flex items-start gap-3">
                          <a href={r.evidence_url} target="_blank" rel="noreferrer" className="block w-32 h-20 rounded-lg overflow-hidden border border-border bg-muted shrink-0">
                            <Image src={r.evidence_url} alt="Evidence" className="block w-32 h-20" fittingType="fill" />
                          </a>
                          <div className="flex flex-col gap-2">
                            <Button size="sm" variant="outline" onClick={() => pickFile(r)} disabled={uploadingId === r.id}>
                              {uploadingId === r.id ? "Uploading…" : "Replace"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => removeEvidence(r)}>Remove</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => pickFile(r)} disabled={uploadingId === r.id}>
                          <Paperclip className="w-4 h-4" /> {uploadingId === r.id ? "Uploading…" : "Upload evidence"}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {o ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <NetworkBadge network={o.network} />
                        <span>Order:</span>
                        <StatusBadge status={o.status} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Order not linked</span>
                    )}
                    <div className="flex gap-2">
                      {r.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => setReviewing(r)}>Mark reviewing</Button>
                      )}
                      {(r.status === "open" || r.status === "reviewing") && (
                        <Button size="sm" onClick={() => openResolve(r)}>Resolve</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!resolving} onOpenChange={(v) => !v && closeResolve()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set the new order status. The customer (via "Check order") and the agent will see the updated status.
            </p>
            <div>
              <Label>New order status</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground mt-1.5"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <Label>Resolution note</Label>
              <Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="What was done…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeResolve}>Cancel</Button>
            <Button onClick={saveResolve} disabled={busy}>{busy ? "Saving…" : "Resolve"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChosen} />
    </div>
  );
}