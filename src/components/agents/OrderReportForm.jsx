import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REASONS = ["Data not delivered", "Wrong bundle received", "Payment issue", "Slow delivery", "Other"];

export default function OrderReportForm({ order, onSubmit, onCancel }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!reason) return;
    onSubmit({ reason, details });
  };

  const selCls = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg bg-muted/50 border border-border p-3 text-sm text-muted-foreground">
        Reporting order <span className="font-mono font-medium text-foreground">{order.code || "—"}</span> · {order.package_name || "Bundle"} · {order.recipient_number}
      </div>
      <div>
        <Label>What's the issue? *</Label>
        <select className={selCls} value={reason} onChange={(e) => setReason(e.target.value)} required>
          <option value="">Select a reason…</option>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <Label>Details</Label>
        <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell us what happened…" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!reason}>Submit report</Button>
      </div>
    </form>
  );
}