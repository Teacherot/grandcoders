import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useRole } from "@/components/RoleShell";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import {
  Plus,
  ClipboardList,
  Flag,
  Search,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AgentOrderForm from "@/components/agents/AgentOrderForm";
import BulkPasteOrders from "@/components/agents/BulkPasteOrders";
import OrderReportForm from "@/components/agents/OrderReportForm";
import ReportEvidence from "@/components/reports/ReportEvidence";
import { nextCode, nextCodes } from "@/lib/shortCode";
import { pushOrderToGmpl, getAgentBalance } from "@/lib/gmpl";
import { toast } from "@/components/ui/use-toast";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

const REPORT_STATUS_STYLE = {
  open:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300",
  reviewing:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300",
  resolved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300",
  rejected:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300",
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

  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 25;

  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportOrder, setReportOrder] = useState(null);

  const [expanded, setExpanded] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const [packages, setPackages] = useState([]);
  const [prices, setPrices] = useState([]);

  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  /*
   * ---------------------------------------------------------
   * FORM LOOKUPS
   * ---------------------------------------------------------
   */

  const ensureFormLookups = () => {
    if (lookupsLoaded) return;

    setLookupsLoaded(true);

    base44.entities.Package.list().then(setPackages);

    base44.entities.AgentPrice.filter({
      agent_id: agent.id,
      active: true,
    }).then(setPrices);
  };

  /*
   * ---------------------------------------------------------
   * LOAD ORDERS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!agent) return;

    loadOrders();
    reloadReports();
  }, [agent?.id]);

  const loadOrders = async () => {
    try {
      const result = await base44.entities.Order.filter(
        { agent_id: agent.id },
        "-created_date",
        5000
      );

      setOrders(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Failed to load orders:", error);

      toast({
        title: "Couldn't load orders",
        description: String(error?.message || error),
        variant: "destructive",
      });

      setOrders([]);
    }
  };

  const reload = () => {
    loadOrders();
  };

  const reloadReports = () =>
    base44.entities.Report.filter(
      { agent_id: agent.id },
      "-created_date",
      5000
    ).then((result) => setReports(Array.isArray(result) ? result : []));

  /*
   * ---------------------------------------------------------
   * CREATE SINGLE ORDER
   * ---------------------------------------------------------
   */

  const saveOrder = async (data) => {
    try {
      const balance = await getAgentBalance();

      if (balance < Number(data.amount || 0)) {
        toast({
          title: "Insufficient wallet balance",
          description: `This order costs ${cedi(
            data.amount
          )} but your wallet has ${cedi(
            balance
          )}. Top up your wallet to place it.`,
          variant: "destructive",
        });

        return;
      }

      const balanceAfter = Number(
        (balance - Number(data.amount || 0)).toFixed(2)
      );

      const o = await base44.entities.Order.create({
        ...data,
        agent_id: agent.id,
        agent_name: agent.full_name,
        agent_email: agent.email,
        code: await nextCode("Order", "O"),
        balance_after: balanceAfter,
      });

      setOpen(false);

      const res = await pushOrderToGmpl(o);

      reload();

      if (res?.ok) {
        toast({
          title: "Order placed",
          description: `${o.package_name || "Bundle"} → ${
            o.recipient_number
          } is ${res.status}.`,
        });
      }
    } catch (e) {
      toast({
        title: "Couldn't place order",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  /*
   * ---------------------------------------------------------
   * CREATE BULK ORDERS
   * ---------------------------------------------------------
   */

  const saveBulk = async (rows) => {
    try {
      const total = rows.reduce(
        (s, r) => s + Number(r.amount || 0),
        0
      );

      const balance = await getAgentBalance();

      if (balance < total) {
        toast({
          title: "Insufficient wallet balance",
          description: `These ${rows.length} order(s) cost ${cedi(
            total
          )} but your wallet has ${cedi(
            balance
          )}. Top up your wallet to place them.`,
          variant: "destructive",
        });

        return;
      }

      let runningBalance = balance;

      const codes = await nextCodes("Order", "O", rows.length);

      const created = await base44.entities.Order.bulkCreate(
        rows.map((r, i) => {
          runningBalance = Number(
            (
              runningBalance - Number(r.amount || 0)
            ).toFixed(2)
          );

          return {
            ...r,
            agent_id: agent.id,
            agent_name: agent.full_name,
            agent_email: agent.email,
            code: codes[i],
            balance_after: runningBalance,
          };
        })
      );

      setBulkOpen(false);

      const results = await Promise.allSettled(
        (Array.isArray(created) ? created : []).map(
          pushOrderToGmpl
        )
      );

      reload();

      const okCount = results.filter(
        (r) => r.value?.ok
      ).length;

      if (okCount) {
        toast({
          title: `${okCount} order(s) placed`,
          description:
            "They're now being sent to the supplier.",
        });
      }
    } catch (e) {
      toast({
        title: "Couldn't place orders",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  /*
   * ---------------------------------------------------------
   * REPORTS
   * ---------------------------------------------------------
   */

  const openReport = (o) => {
    setReportOrder(o);
    setReportOpen(true);
  };

  const saveReport = async (data) => {
    const o = reportOrder;

    if (o?.status !== "completed") return;

    await base44.entities.Report.create({
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
    });

    setReportOpen(false);
    setReportOrder(null);

    reloadReports();
  };

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
   */

  const normalizeSearch = (value) =>
    String(value ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  const searchTerm = normalizeSearch(q);

  const matchesQ = (o) => {
    if (!searchTerm) return true;

    const searchableFields = [
      o?.id,
      o?.code,
      o?.reference,
      o?.order_reference,
      o?.customer_name,
      o?.customer_number,
      o?.recipient_number,
      o?.phone,
      o?.package_name,
      o?.network,
      o?.status,
      o?.payment_method,
      o?.amount,
      o?.volume_gb,
      o?.agent_name,
      o?.agent_email,
    ];

    return searchableFields.some((value) =>
      normalizeSearch(value).includes(searchTerm)
    );
  };

  /*
   * ---------------------------------------------------------
   * RESET PAGINATION WHEN SEARCH/FILTER CHANGES
   * ---------------------------------------------------------
   */

  useEffect(() => {
    setCurrentPage(1);
  }, [q, filter, showArchived]);

  /*
   * ---------------------------------------------------------
   * FILTER ORDERS
   * ---------------------------------------------------------
   */

  if (!agent) return null;

  const list = orders || [];

  const shown = list.filter(
    (o) =>
      matchesQ(o) &&
      (filter === "all" || o.status === filter) &&
      (showArchived || !o.archived)
  );

  const activeReports = (oid) =>
    reports.filter(
      (r) =>
        r.order_id === oid &&
        r.created_date &&
        Date.now() -
          new Date(r.created_date).getTime() <
          TWO_DAYS
    );

  const totalPages =
    Math.ceil((shown?.length || 0) / PAGE_SIZE) || 1;

  const paginatedOrders = (shown || []).slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div>
      <PageHeader
        title="My orders"
        subtitle="Orders placed through your store — report issues on completed orders"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                ensureFormLookups();
                setBulkOpen(true);
              }}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Bulk paste
            </Button>

            <Button
              onClick={() => {
                ensureFormLookups();
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New order
            </Button>
          </div>
        }
      />

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

          <Input
            className="pl-9"
            placeholder="Search order, reference, number, customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select
          value={filter}
          onValueChange={setFilter}
        >
          <SelectTrigger className="w-[160px] h-9 capitalize">
            <SelectValue placeholder="Status" />
          </SelectTrigger>

          <SelectContent>
            {FILTERS.map(([k, l]) => (
              <SelectItem key={k} value={k}>
                {l === "All" ? "All statuses" : l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={
            showArchived ? "default" : "outline"
          }
          className="h-9"
          onClick={() =>
            setShowArchived((v) => !v)
          }
        >
          {showArchived
            ? "Showing archived"
            : "Show archived"}
        </Button>
      </div>

      {/* ORDER LIST */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {!orders ? (
          <p className="p-6 text-sm text-muted-foreground">
            Loading…
          </p>
        ) : shown.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              No orders found.
            </p>

            {q && (
              <p className="text-xs text-muted-foreground mt-1">
                Try searching by order code, reference,
                phone number, customer name, or package.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* MOBILE VIEW */}
            <div className="md:hidden divide-y divide-border">
              {paginatedOrders.map((o) => {
                const ar = activeReports(o.id);

                const allForOrder = reports.filter(
                  (r) => r.order_id === o.id
                );

                const resolved = allForOrder.some(
                  (r) => r.status === "resolved"
                );

                const inWindow =
                  o.status === "completed" &&
                  o.updated_date &&
                  Date.now() -
                    new Date(o.updated_date).getTime() <
                    TWO_DAYS;

                const canReport =
                  o.status === "completed" &&
                  inWindow &&
                  !resolved;

                return (
                  <div key={o.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">
                          {o.code || "—"}
                        </p>

                        <p className="text-foreground font-medium mt-1">
                          {o.package_name || "Bundle"}
                        </p>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.recipient_number}
                        </p>
                      </div>

                      <StatusBadge status={o.status} />
                    </div>

                    <div className="flex items-center justify-between mt-3 text-sm">
                      <span className="text-foreground">
                        {cedi(o.amount)}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {o.created_date
                          ? format(
                              new Date(o.created_date),
                              "MMM d, HH:mm"
                            )
                          : ""}
                      </span>
                    </div>

                    {ar.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {ar.map((r) => (
                          <span
                            key={r.id}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                              REPORT_STATUS_STYLE[
                                r.status
                              ] ||
                              REPORT_STATUS_STYLE.open
                            }`}
                          >
                            {r.reason} ·{" "}
                            {r.created_date
                              ? format(
                                  new Date(
                                    r.created_date
                                  ),
                                  "MMM d, HH:mm"
                                )
                              : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <button
                        className="text-xs text-primary"
                        onClick={() =>
                          setExpanded(
                            expanded === o.id
                              ? null
                              : o.id
                          )
                        }
                      >
                        {expanded === o.id
                          ? "Hide details"
                          : "View details"}
                      </button>

                      {canReport ? (
                        <button
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-600"
                          onClick={() =>
                            openReport(o)
                          }
                        >
                          <Flag className="w-3.5 h-3.5" />
                          {ar.length
                            ? `Reported (${ar.length})`
                            : "Report"}
                        </button>
                      ) : o.status ===
                        "completed" ? (
                        <span className="text-xs text-muted-foreground/60">
                          {resolved
                            ? "Resolved"
                            : "Window closed"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          —
                        </span>
                      )}
                    </div>

                    {expanded === o.id && (
                      <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Network
                          </p>
                          <p className="text-foreground mt-0.5">
                            {o.network || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Volume
                          </p>
                          <p className="text-foreground mt-0.5">
                            {o.volume_gb
                              ? `${o.volume_gb} GB`
                              : "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Payment
                          </p>
                          <p className="text-foreground mt-0.5 capitalize">
                            {o.payment_method || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Customer
                          </p>
                          <p className="text-foreground mt-0.5">
                            {o.customer_name || "—"}
                          </p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Reference
                          </p>
                          <p className="text-foreground mt-0.5 break-words">
                            {o.reference || "—"}
                          </p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Updated
                          </p>
                          <p className="text-foreground mt-0.5">
                            {o.updated_date
                              ? format(
                                  new Date(
                                    o.updated_date
                                  ),
                                  "MMM d, HH:mm"
                                )
                              : "—"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="p-4 font-medium">Order</th>
                    <th className="p-4 font-medium">Customer / Recipient</th>
                    <th className="p-4 font-medium">Package</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedOrders.map((o) => {
                    const ar = activeReports(o.id);
                    const allForOrder = reports.filter((r) => r.order_id === o.id);
                    const resolved = allForOrder.some((r) => r.status === "resolved");
                    const inWindow =
                      o.status === "completed" &&
                      o.updated_date &&
                      Date.now() - new Date(o.updated_date).getTime() < TWO_DAYS;
                    const canReport = o.status === "completed" && inWindow && !resolved;

                    return (
                      <tr key={o.id} className="hover:bg-muted/30">
                        <td className="p-4 font-mono text-xs">{o.code || "—"}</td>
                        <td className="p-4">
                          <p className="font-medium text-foreground">{o.recipient_number}</p>
                          {o.customer_name && (
                            <p className="text-xs text-muted-foreground">{o.customer_name}</p>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-foreground">{o.package_name || "Bundle"}</p>
                          <p className="text-xs text-muted-foreground">{o.network || ""}</p>
                        </td>
                        <td className="p-4 font-medium text-foreground">{cedi(o.amount)}</td>
                        <td className="p-4">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {o.created_date ? format(new Date(o.created_date), "MMM d, yyyy HH:mm") : "—"}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canReport && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => openReport(o)}
                              >
                                <Flag className="w-3.5 h-3.5 mr-1" />
                                {ar.length ? `Reported (${ar.length})` : "Report"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border text-sm">
                <span className="text-muted-foreground text-xs">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALS */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
          </DialogHeader>
          <AgentOrderForm
            packages={packages}
            prices={prices}
            onSubmit={saveOrder}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Bulk Paste Orders</DialogTitle>
          </DialogHeader>
          <BulkPasteOrders
            packages={packages}
            prices={prices}
            onSubmit={saveBulk}
            onCancel={() => setBulkOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Report Order Issue</DialogTitle>
          </DialogHeader>
          {reportOrder && (
            <OrderReportForm
              order={reportOrder}
              onSubmit={saveReport}
              onCancel={() => {
                setReportOpen(false);
                setReportOrder(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
