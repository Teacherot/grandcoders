import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, CheckCircle2 } from "lucide-react";
import { createReportInSupabase, getOrdersFromSupabase } from "@/lib/supabaseData";

const REASONS = ["Data not delivered", "Wrong bundle received", "Payment issue", "Slow delivery", "Other"];

export default function ReportTab({ agent }) {
  const [code, setCode] = useState("");
  const [order, setOrder] = useState(null);
  const [searched, setSearched] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  const find = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    const rows = await getOrdersFromSupabase().catch(() => []);
    const found = (rows || []).find((row) => String(row.code || "").trim().toLowerCase() === code.trim().toLowerCase());
    setOrder(found || null);
    setSearched(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!order || !reason) return;
    setBusy(true);
    try {
      const created = await createReportInSupabase({
        agent_id: agent?.id || "",
        agent_name: agent?.full_name || agent?.store_name || "",
        agent_email: agent?.email || "",
        order_id: order.id || "",
        customer_name: order.customer_name || "",
        recipient_number: order.recipient_number || "",
        package_name: order.package_name || "",
        network: order.network || "",
        reason,
        details,
        status: "open",
      });
      setDone(created || null);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
        <h2 className="text-lg font-semibold mt-3">Report submitted</h2>
        <p className="text-sm text-muted-foreground mt-1">Our team has been notified and will look into this. Check back here to see the updated status.</p>
        <Button className="mt-5" variant="outline" onClick={() => { setDone(null); setReason(""); setDetails(""); setCode(""); setOrder(null); setSearched(false); }}>
          Submit another report
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={find} className="flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter your order ID (e.g. 104823)" inputMode="numeric" />
        <Button type="submit" variant="outline"><Search className="w-4 h-4" /> Find</Button>
      </form>

      {searched && !order && (
        <p className="text-sm text-muted-foreground">No order found with that ID. Double-check the ID from your order confirmation.</p>
      )}

      {order && (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{order.package_name || "Bundle"}</span>
              <span className="text-xs text-muted-foreground">#{order.code || order.id.slice(-6)}</span>
            </div>
            <div className="text-muted-foreground">{order.recipient_number} · {order.network}</div>
            <div className="text-muted-foreground">Status: {order.status}</div>
          </div>
          <div>
            <Label>What's the issue? *</Label>
            <select className="h-10 w-full rounded-md border border-input bg-card text-foreground px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">Select a reason…</option>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <Label>Details</Label>
            <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what happened…" />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !reason}>
            {busy ? "Submitting…" : "Submit report"}
          </Button>
        </form>
      )}
    </div>
  );
}