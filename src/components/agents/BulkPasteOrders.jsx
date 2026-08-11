import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAgentOptions } from "@/components/agents/AgentOrderForm";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function BulkPasteOrders({ packages, prices, onSubmit, onCancel }) {
  const options = useMemo(() => buildAgentOptions(packages, prices).filter((o) => o.network === "MTN"), [packages, prices]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => {
    const lookup = {};
    options.forEach((o) => { lookup[o.volume_gb] = o; });
    const rows = [];
    text.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const parts = line.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) return;
      const phone = parts[0];
      const vol = Number(parts[1]);
      const opt = lookup[vol];
      if (opt && phone) {
        rows.push({
          recipient_number: phone,
          network: "MTN",
          package_name: opt.name,
          volume_gb: opt.volume_gb,
          amount: opt.cost,
          payment_method: "momo",
          status: "pending",
        });
      }
    });
    return rows;
  }, [text, options]);

  const total = parsed.reduce((s, r) => s + Number(r.amount || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!parsed.length) return;
    setSaving(true);
    try { await onSubmit(parsed); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>One order per line — format: <code className="text-foreground">phone&nbsp;volume</code> (MTN only, space or comma both work)</Label>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"0241234567 5\n0249998877 10\n0266554433 2"}
          className="font-mono text-sm"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {parsed.length} valid line(s) · total {cedi(total)}
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || !parsed.length}>{saving ? "Placing…" : `Place ${parsed.length} order(s)`}</Button>
      </div>
    </form>
  );
}