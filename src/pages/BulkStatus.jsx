import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Ban } from "lucide-react";

export default function BulkStatus() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (status) => {
    const numbers = [...new Set(text.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean))];
    if (numbers.length === 0) return;
    setBusy(true);
    const all = await base44.entities.Order.list("-created_date", 500);
    const matched = all.filter((o) => numbers.includes(o.recipient_number));
    if (matched.length) {
      const updates = matched.map((o) => {
        if (status === "cancelled") return { id: o.id, status: "cancelled", reference: (o.reference ? o.reference + " | " : "") + "auto-refund" };
        return { id: o.id, status: "completed" };
      });
      await base44.entities.Order.bulkUpdate(updates);
    }
    setResult({ requested: numbers.length, matched: matched.length, status });
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Bulk status update" subtitle="Paste recipient numbers and update them in one go" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Textarea rows={10} placeholder={"0244000111\n0209000222\n0551000333"} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" />
          <div className="flex flex-col gap-3 mt-4 sm:flex-row">
            <Button className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto" disabled={busy} onClick={() => run("completed")}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Mark completed
            </Button>
            <Button variant="destructive" className="w-full sm:w-auto" disabled={busy} onClick={() => run("cancelled")}>
              <Ban className="w-4 h-4 mr-2" /> Cancel &amp; auto-refund
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">How it works</p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Paste recipient numbers — one per line, or separated by commas/spaces.</li>
            <li>Choose an action. Every order matching those numbers updates at once.</li>
            <li><b className="text-foreground">Cancel &amp; auto-refund</b> marks orders cancelled and tags them for refund.</li>
            <li><b className="text-foreground">Mark completed</b> confirms delivery and locks in agent commission.</li>
          </ol>
          {result && (
            <div className="mt-6 rounded-xl bg-muted/50 border border-border p-4 text-sm">
              <p className="font-medium text-foreground">{result.status === "completed" ? "Completed" : "Cancelled & auto-refunded"}</p>
              <p className="text-muted-foreground mt-1">{result.matched} of {result.requested} numbers matched and were updated.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}