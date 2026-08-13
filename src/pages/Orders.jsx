import React, { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import NetworkBadge from "@/components/NetworkBadge";
import OrderForm from "@/components/orders/OrderForm";
import OrderEvidence from "@/components/orders/OrderEvidence";
import { nextCode } from "@/lib/shortCode";
import { pushOrderToGmpl } from "@/lib/gmpl";
import { toast } from "@/components/ui/use-toast";
import { createOrderInSupabase, deleteOrderInSupabase, getAgentsFromSupabaseLive, getOrdersFromSupabase, getPackagesFromSupabase, updateOrderInSupabase } from "@/lib/supabaseData";

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [packages, setPackages] = useState([]);
  const [agents, setAgents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [exNet, setExNet] = useState("all");
  const [exStatus, setExStatus] = useState("pending");
  const [expanded, setExpanded] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const ensureFormLookups = () => {
    if (lookupsLoaded) return;
    setLookupsLoaded(true);
    getPackagesFromSupabase().then(setPackages).catch(() => setPackages([]));
    getAgentsFromSupabaseLive().then(setAgents).catch(() => setAgents([]));
  };

  const load = async () => {
    const rows = await getOrdersFromSupabase();
    setOrders(rows);
  };

  useEffect(() => { load(); }, []);

  const save = async (data) => {
    if (editing) {
      await updateOrderInSupabase(editing.id, data);
    } else {
      const o = await createOrderInSupabase({ ...data, source: "admin", code: await nextCode("Order", "O") });
      const res = await pushOrderToGmpl(o);
      if (res?.ok) toast({ title: "Order placed", description: `${o.package_name || "Bundle"} → ${o.recipient_number} is ${res.status}.` });
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    await deleteOrderInSupabase(id);
    load();
  };

  const exportOrders = () => {
    const list = (orders || []).filter((o) => (exNet === "all" || o.network === exNet) && (exStatus === "all" || o.status === exStatus));
    if (list.length === 0) return;
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = list.map((o) => `<tr><td>${esc(o.code)}</td><td>${esc(o.recipient_number)}</td><td>${esc(o.customer_name)}</td><td>${esc(o.package_name)}</td><td>${esc(o.volume_gb)}</td><td>${esc(o.network)}</td><td>${esc(o.agent_name)}</td><td>${esc(o.status)}</td><td>${esc(o.payment_method)}</td><td>${esc(o.reference)}</td></tr>`).join("");
    const html = `<table border="1"><tr><th>Code</th><th>Phone</th><th>Customer</th><th>Package</th><th>Data (GB)</th><th>Network</th><th>Agent</th><th>Status</th><th>Payment</th><th>Reference</th></tr>${body}</table>`;
    const blob = new Blob([`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `orders-${exStatus}-${exNet}.xls`; a.click();
    URL.revokeObjectURL(url);
  };

  const selCls = "h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground";

  // Filtered rows based on search, status tab, and archive toggle
  const filteredRows = useMemo(() => {
    return (orders || []).filter((o) => {
      const matchQ = !q || [o.code, o.reference, o.customer_name, o.recipient_number, o.package_name, o.agent_name].join(" ").toLowerCase().includes(q.toLowerCase());
      return matchQ && (filter === "all" || o.status === filter) && (showArchived || !o.archived);
    });
  }, [orders, q, filter, showArchived]);

  // Calculate pagination properties
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage]);

  const handleSearchChange = (e) => {
    setQ(e.target.value);
    setCurrentPage(1); // Reset to page 1 on new search query
  };

  const handleFilterChange = (val) => {
    setFilter(val);
    setCurrentPage(1); // Reset to page 1 on status tab filter change
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Every bundle request in one place"
        action={<Button onClick={() => { setEditing(null); ensureFormLookups(); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />New order</Button>}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <Input className="max-w-xs" placeholder="Search reference, number, customer, agent…" value={q} onChange={handleSearchChange} />
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[160px] h-9 capitalize">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto min-w-0">
          <select className={selCls} value={exNet} onChange={(e) => setExNet(e.target.value)}>
            <option value="all">All networks</option>
            <option value="MTN">MTN</option>
            <option value="Telecel">Telecel</option>
            <option value="AirtelTigo">AirtelTigo</option>
            <option value="Other">Other</option>
          </select>
          <select className={selCls} value={exStatus} onChange={(e) => setExStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant={showArchived ? "default" : "outline"} onClick={() => { setShowArchived((v) => !v); setCurrentPage(1); }}>{showArchived ? "Showing archived" : "Show archived"}</Button>
          <Button variant="outline" onClick={exportOrders}>Export Excel</Button>
        </div>
      </div>

      {!orders ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-sm text-muted-foreground">No orders here yet.</div>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {paginatedRows.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-card shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{o.code || "—"}</p>
                    <p className="text-foreground font-medium mt-1 break-words">{o.recipient_number}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_name || "—"}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <NetworkBadge network={o.network} />
                  <span className="text-sm text-foreground truncate">{o.package_name || `${o.volume_gb || "-"} GB`}</span>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span className="truncate">{o.agent_name || "Direct"} · <span className="capitalize">{o.payment_method || "—"}</span></span>
                  <span className="whitespace-nowrap">{o.created_date ? format(new Date(o.created_date), "MMM d, HH:mm") : ""}</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button className="text-xs text-primary" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    {expanded === o.id ? "Hide details" : "View details"}
                  </button>
                  <div className="flex items-center gap-3">
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditing(o); ensureFormLookups(); setOpen(true); }}><Pencil className="w-4 h-4" /></button>
                    <button className="text-muted-foreground/60 hover:text-destructive" onClick={() => remove(o.id)}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {expanded === o.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <OrderEvidence order={o} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-normal hidden sm:table-cell">#</th>
                  <th className="px-5 py-3 text-left font-normal">Recipient</th>
                  <th className="px-5 py-3 text-left font-normal hidden md:table-cell">Bundle</th>
                  <th className="px-5 py-3 text-left font-normal hidden lg:table-cell">Agent</th>
                  <th className="px-5 py-3 text-left font-normal hidden md:table-cell">Payment</th>
                  <th className="px-5 py-3 text-left font-normal">Status</th>
                  <th className="px-5 py-3 text-left font-normal hidden lg:table-cell">Date</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedRows.map((o) => (
                  <React.Fragment key={o.id}>
                    <tr
                      className={`hover:bg-muted/40 cursor-pointer transition-colors ${expanded === o.id ? "bg-muted/40" : ""}`}
                      onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                    >
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground hidden sm:table-cell">{o.code || "—"}</td>
                      <td className="px-5 py-4">
                        <p className="text-foreground font-medium">{o.recipient_number}</p>
                        <p className="text-xs text-muted-foreground">{o.customer_name || "—"}</p>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <NetworkBadge network={o.network} />
                          <span className="text-foreground">{o.package_name || `${o.volume_gb || "-"} GB`}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{o.volume_gb ? `${o.volume_gb} GB` : "—"}</p>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground">{o.agent_name || "Direct"}</td>
                      <td className="px-5 py-4 hidden md:table-cell text-muted-foreground capitalize">{o.payment_method || "—"}</td>
                      <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                      <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground text-xs">{o.created_date ? format(new Date(o.created_date), "MMM d, HH:mm") : ""}</td>
                      <td className="px-2 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button className="text-muted-foreground hover:text-foreground mr-2" onClick={() => { setEditing(o); ensureFormLookups(); setOpen(true); }}><Pencil className="w-4 h-4" /></button>
                        <button className="text-muted-foreground/60 hover:text-destructive" onClick={() => remove(o.id)}><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                    {expanded === o.id && (
                      <tr>
                        <td colSpan={8} className="px-5 py-5 bg-muted/30 border-t border-border">
                          <OrderEvidence order={o} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 0.5rem' }}>
            <span className="text-sm text-muted-foreground">
              Showing {paginatedRows.length ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length} entries
            </span>
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit order" : "New order"}</DialogTitle></DialogHeader>
          <OrderForm key={editing?.id || "new"} initial={editing} packages={packages} agents={agents} onSubmit={save} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
