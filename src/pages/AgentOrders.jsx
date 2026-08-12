import React, { useEffect, useState } from "react";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import { Plus, ClipboardList, Flag, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AgentOrderForm from "@/components/agents/AgentOrderForm";
import BulkPasteOrders from "@/components/agents/BulkPasteOrders";
import OrderReportForm from "@/components/agents/OrderReportForm";
import ReportEvidence from "@/components/reports/ReportEvidence";
import { nextCode, nextCodes } from "@/lib/shortCode";
import { pushOrderToGmpl, getAgentBalance } from "@/lib/gmpl";
import { createOrderInSupabase, createReportInSupabase, getOrdersFromSupabase, getPackagesFromSupabase, getReportsFromSupabase } from "@/lib/supabaseData";
import { toast } from "@/components/ui/use-toast";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

const REPORT_STATUS_STYLE = {
  open: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300",
  reviewing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300",
};

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["processing", "Processing"],
  ["completed", "Completed"],
  ["failed", "Failed"],
  ["cancelled", "Cancelled"],
];

export default function AgentOrders() {
  const { agent } = useRole();
  const [orders, setOrders] = useState(null);
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOrder, setReportOrder] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [packages, setPackages] = useState([]);
  const [prices, setPrices] = useState([]);

  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const ensureFormLookups = () => {
    if (lookupsLoaded) return;
    setLookupsLoaded(true);
    getPackagesFromSupabase().then(setPackages).catch(() => {});
    setPrices([]);
  };

  useEffect(() => {
    if (!agent) return;
    getOrdersFromSupabase().then((rows) => setOrders((rows || []).filter((row) => row.agent_id === agent.id))).catch(() => setOrders([]));
    reloadReports();
  }, [agent?.id]);

  const reload = async () => {
    const rows = await getOrdersFromSupabase();
    setOrders((rows || []).filter((row) => row.agent_id === agent.id));
  };
  const reloadReports = async () => {
    const rows = await getReportsFromSupabase();
    setReports((rows || []).filter((row) => row.agent_id === agent.id));
  };

  const saveOrder = async (data) => {
    try {
      const balance = await getAgentBalance();
      if (balance < Number(data.amount || 0)) {
        toast({
          title: "Insufficient wallet balance",
          description: `This order costs ${cedi(data.amount)} but your wallet has ${cedi(balance)}. Top up your wallet to place it.`,
          variant: "destructive",
        });
        return;
      }
      const o = await createOrderInSupabase({ ...data, agent_id: agent.id, agent_name: agent.full_name, agent_email: agent.email, code: await nextCode("Order", "O") });
      setOpen(false);
      const res = await pushOrderToGmpl(o);
      reload();
      if (res?.ok) {
        toast({ title: "Order placed", description: `${o.package_name || "Bundle"} → ${o.recipient_number} is ${res.status}.` });
      }
    } catch (e) {
      toast({ title: "Couldn't place order", description: String(e?.message || e), variant: "destructive" });
    }
  };
  const saveBulk = async (rows) => {
    try {
      const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const balance = await getAgentBalance();
      if (balance < total) {
        toast({
          title: "Insufficient wallet balance",
          description: `These ${rows.length} order(s) cost ${cedi(total)} but your wallet has ${cedi(balance)}. Top up your wallet to place them.`,
          variant: "destructive",
        });
        return;
      }
      const codes = await nextCodes("Order", "O", rows.length);
      const created = await Promise.all(rows.map((r, i) => createOrderInSupabase({ ...r, agent_id: agent.id, agent_name: agent.full_name, agent_email: agent.email, code: codes[i] })));
      setBulkOpen(false);
      const results = await Promise.allSettled((Array.isArray(created) ? created : []).map(pushOrderToGmpl));
      reload();
      const okCount = results.filter((r) => r.value?.ok).length;
      if (okCount) toast({ title: `${okCount} order(s) placed`, description: "They're now being sent to the supplier." });
    } catch (e) {
      toast({ title: "Couldn't place orders", description: String(e?.message || e), variant: "destructive" });
    }
  };

  const openReport = (o) => { setReportOrder(o); setReportOpen(true); };
  const saveReport = async (data) => {
    const o = reportOrder;
    if (o?.status !== "completed") return;
    await createReportInSupabase({
      id: `report-${Date.now()}`,
      order_id: o.id,
      order_reference: o.reference || "",
      agent_id: agent.id,
      agent_name: agent.full_name,
      agent_email: agent.email,
      customer_name: o.customer_name || "",
      recipient_number: o.recipient_number,
      package_name: o.package_name || "",
      network: o.network || "",
      reason: data.reason,
      details: data.details,
      status: "open",
      created_date: new Date().toISOString(),
    });
    setReportOpen(false);
    setReportOrder(null);
    reloadReports();
  };

  if (!agent) return null;
  const list = orders || [];
  const matchesQ = (o) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [o.code, o.reference, o.customer_name, o.recipient_number, o.package_name].map((v) => (v || "").toLowerCase()).some((v) => v.includes(s));
  };
  const shown = list.filter((o) => matchesQ(o) && (filter === "all" || o.status === filter) && (showArchived || !o.archived));
  const activeReports = (oid) => reports.filter((r) => r.order_id === oid && r.created_date && Date.now() - new Date(r.created_date).getTime() < TWO_DAYS);

  return (
    <div>
      <PageHeader
        title="My orders"
        subtitle="Orders placed through your store — report issues on completed orders"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { ensureFormLookups(); setBulkOpen(true); }}><ClipboardList className="w-4 h-4 mr-2" />Bulk paste</Button>
            <Button onClick={() => { ensureFormLookups(); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />New order</Button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search reference code or customer name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-9 capitalize">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map(([k, l]) => (
              <SelectItem key={k} value={k}>{l === "All" ? "All statuses" : l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={showArchived ? "default" : "outline"} className="h-9" onClick={() => setShowArchived((v) => !v)}>{showArchived ? "Showing archived" : "Show archived"}</Button>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {!orders ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No orders.</p>
        ) : (
          <>
          <div className="md:hidden divide-y divide-border">
            {shown.map((o) => {
              const ar = activeReports(o.id);
              const allForOrder = reports.filter((r) => r.order_id === o.id);
              const resolved = allForOrder.some((r) => r.status === "resolved");
              const inWindow = o.status === "completed" && o.updated_date && Date.now() - new Date(o.updated_date).getTime() < TWO_DAYS;
              const canReport = o.status === "completed" && inWindow && !resolved;
              return (
                <div key={o.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{o.code || "—"}</p>
                      <p className="text-foreground font-medium mt-1">{o.package_name || "Bundle"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{o.recipient_number}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-foreground">{cedi(o.amount)}</span>
                    <span className="text-xs text-muted-foreground">{o.created_date ? format(new Date(o.created_date), "MMM d, HH:mm") : ""}</span>
                  </div>
                  {ar.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {ar.map((r) => (
                        <span key={r.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${REPORT_STATUS_STYLE[r.status] || REPORT_STATUS_STYLE.open}`}>
                          {r.reason} · {r.created_date ? format(new Date(r.created_date), "MMM d, HH:mm") : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <button className="text-xs text-primary" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      {expanded === o.id ? "Hide details" : "View details"}
                    </button>
                    {canReport ? (
                      <div className="flex flex-col items-end gap-1">
                        <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600" onClick={() => openReport(o)}>
                          <Flag className="w-3.5 h-3.5" />{ar.length ? `Reported (${ar.length})` : "Report"}
                        </button>
                        <span className="text-[11px] text-muted-foreground/60">Reports are available for 2 days after completion.</span>
                      </div>
                    ) : o.status === "completed" ? (
                      <span className="text-xs text-muted-foreground/60">{resolved ? "Resolved" : "Reporting window closed"}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </div>
                  {expanded === o.id && (
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Network</p><p className="text-foreground mt-0.5">{o.network || "—"}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Volume</p><p className="text-foreground mt-0.5">{o.volume_gb ? `${o.volume_gb} GB` : "—"}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Payment</p><p className="text-foreground mt-0.5 capitalize">{o.payment_method || "—"}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer</p><p className="text-foreground mt-0.5">{o.customer_name || "—"}</p></div>
                      <div className="col-span-2"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reference</p><p className="text-foreground mt-0.5 break-words">{o.reference || "—"}</p></div>
                      <div className="col-span-2"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Updated</p><p className="text-foreground mt-0.5">{o.updated_date ? format(new Date(o.updated_date), "MMM d, yyyy · HH:mm") : "—"}</p></div>
                      {o.evidence_url && <div className="col-span-2"><ReportEvidence url={o.evidence_url} label="Delivery evidence" /></div>}
                      {canReport && (
                        <div className="col-span-2"><Button size="sm" variant="outline" onClick={() => openReport(o)}><Flag className="w-4 h-4" /> {ar.length ? `Report issue (${ar.length})` : "Report issue"}</Button></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-normal">#</th>
                <th className="px-5 py-3 text-left font-normal">Package</th>
                <th className="px-5 py-3 text-left font-normal">Recipient</th>
                <th className="px-5 py-3 text-left font-normal">Amount</th>
                <th className="px-5 py-3 text-left font-normal">Date</th>
                <th className="px-5 py-3 text-left font-normal">Status</th>
                <th className="px-5 py-3 text-right font-normal">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((o) => {
                const ar = activeReports(o.id);
                const allForOrder = reports.filter((r) => r.order_id === o.id);
                const resolved = allForOrder.some((r) => r.status === "resolved");
                const inWindow = o.status === "completed" && o.updated_date && Date.now() - new Date(o.updated_date).getTime() < TWO_DAYS;
                const canReport = o.status === "completed" && inWindow && !resolved;
                return (
                  <React.Fragment key={o.id}>
                    <tr className="cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded === o.id ? "rotate-90" : ""}`} />
                          {o.code || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-foreground">{o.package_name || "Bundle"}</td>
                      <td className="px-5 py-4 text-muted-foreground">{o.recipient_number}</td>
                      <td className="px-5 py-4 text-foreground">{cedi(o.amount)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{o.created_date ? format(new Date(o.created_date), "MMM d, HH:mm") : ""}</td>
                      <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                      <td className="px-5 py-4 text-right">
                        {canReport ? (
                          <div className="flex flex-col items-end gap-1">
                            <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600" onClick={(e) => { e.stopPropagation(); openReport(o); }}>
                              <Flag className="w-3.5 h-3.5" />{ar.length ? `Reported (${ar.length})` : inWindow ? "Report" : "Report completed order"}
                            </button>
                            {!inWindow && (
                              <span className="text-[11px] text-muted-foreground/60">Reporting window closed, but you can still submit a report.</span>
                            )}
                          </div>
                        ) : o.status === "completed" ? (
                          <span className="text-xs text-muted-foreground/60">{resolved ? "Resolved" : "Reporting locked"}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                    </tr>
                    {ar.length > 0 && (
                      <tr className="bg-amber-50/40 dark:bg-amber-950/20">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {ar.map((r) => (
                              <span key={r.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${REPORT_STATUS_STYLE[r.status] || REPORT_STATUS_STYLE.open}`}>
                                {r.reason} · {r.created_date ? format(new Date(r.created_date), "MMM d, HH:mm") : ""}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                    {expanded === o.id && (
                      <tr>
                        <td colSpan={7} className="px-5 py-5 bg-muted/30 border-t border-border">
                          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Network</p>
                              <p className="text-foreground mt-0.5">{o.network || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Volume</p>
                              <p className="text-foreground mt-0.5">{o.volume_gb ? `${o.volume_gb} GB` : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Payment</p>
                              <p className="text-foreground mt-0.5 capitalize">{o.payment_method || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer</p>
                              <p className="text-foreground mt-0.5">{o.customer_name || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reference</p>
                              <p className="text-foreground mt-0.5 break-words">{o.reference || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Updated</p>
                              <p className="text-foreground mt-0.5">{o.updated_date ? format(new Date(o.updated_date), "MMM d, yyyy · HH:mm") : "—"}</p>
                            </div>
                          </div>
                          {o.evidence_url && <ReportEvidence url={o.evidence_url} label="Delivery evidence" />}
                          <div className="mt-4 flex items-center gap-3">
                            {canReport ? (
                              <div className="flex flex-col items-start gap-1">
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openReport(o); }}>
                                  <Flag className="w-4 h-4" /> {ar.length ? `Report issue (${ar.length})` : "Report issue"}
                                </Button>
                                <span className="text-[11px] text-muted-foreground/60">Reports are available for 2 days after completion.</span>
                              </div>
                            ) : o.status === "completed" ? (
                              <span className="text-xs text-muted-foreground/60">{resolved ? "Issue resolved" : "Reporting window closed"}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">Report available once the order is completed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New order</DialogTitle></DialogHeader>
          <AgentOrderForm packages={packages} prices={prices} onSubmit={saveOrder} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bulk paste orders</DialogTitle></DialogHeader>
          <BulkPasteOrders packages={packages} prices={prices} onSubmit={saveBulk} onCancel={() => { setBulkOpen(false); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={(v) => { setReportOpen(v); if (!v) setReportOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Report an order</DialogTitle></DialogHeader>
          {reportOrder && <OrderReportForm order={reportOrder} onSubmit={saveReport} onCancel={() => { setReportOpen(false); setReportOrder(null); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}