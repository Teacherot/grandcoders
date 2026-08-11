import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const empty = {
  customer_name: "", recipient_number: "", network: "MTN", package_name: "",
  volume_gb: "", amount: "", agent_id: "", status: "pending", payment_method: "momo", reference: "",
};

export default function OrderForm({ initial, packages = [], agents = [], onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickPackage = (name) => {
    const p = packages.find((x) => x.name === name);
    setForm((f) => ({ ...f, package_name: name, volume_gb: p?.volume_gb ?? f.volume_gb, amount: p?.price ?? f.amount, network: p?.network ?? f.network }));
  };

  const submit = (e) => {
    e.preventDefault();
    const agent = agents.find((a) => a.id === form.agent_id);
    onSubmit({
      ...form,
      volume_gb: form.volume_gb === "" ? undefined : Number(form.volume_gb),
      amount: Number(form.amount),
      agent_name: agent?.full_name || "",
      agent_email: agent?.email || "",
    });
  };

  const sel = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground";

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div><Label>Customer</Label><Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Name" /></div>
      <div><Label>Recipient number *</Label><Input required value={form.recipient_number} onChange={(e) => set("recipient_number", e.target.value)} placeholder="0244..." /></div>
      <div>
        <Label>Package</Label>
        <select className={sel} value={form.package_name} onChange={(e) => pickPackage(e.target.value)}>
          <option value="">Custom</option>
          {packages.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <Label>Network</Label>
        <select className={sel} value={form.network} onChange={(e) => set("network", e.target.value)}>
          {["MTN", "Telecel", "AirtelTigo", "Other"].map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>
      <div><Label>Volume (GB)</Label><Input type="number" step="0.1" value={form.volume_gb} onChange={(e) => set("volume_gb", e.target.value)} /></div>
      <div><Label>Amount *</Label><Input required type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></div>
      <div>
        <Label>Agent</Label>
        <select className={sel} value={form.agent_id} onChange={(e) => set("agent_id", e.target.value)}>
          <option value="">Direct</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>
      <div>
        <Label>Status</Label>
        <select className={sel} value={form.status} onChange={(e) => set("status", e.target.value)}>
          {["pending", "processing", "completed", "failed"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <Label>Payment</Label>
        <select className={sel} value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
          {["momo", "cash", "wallet"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} /></div>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save order</Button>
      </div>
    </form>
  );
}