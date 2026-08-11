import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const empty = { name: "", network: "MTN", volume_gb: "", price: "", agent_price: "", validity: "No expiry", github_repo: "", active: true };

export default function PackageForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sel = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground";

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      volume_gb: form.volume_gb === "" ? undefined : Number(form.volume_gb),
      price: Number(form.price),
      agent_price: form.agent_price === "" ? undefined : Number(form.agent_price),
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div><Label>Package name *</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="MTN 5GB" /></div>
      <div>
        <Label>Network</Label>
        <select className={sel} value={form.network} onChange={(e) => set("network", e.target.value)}>
          {["MTN", "Telecel", "AirtelTigo", "Other"].map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>
      <div><Label>Volume (GB)</Label><Input type="number" step="0.1" value={form.volume_gb} onChange={(e) => set("volume_gb", e.target.value)} /></div>
      <div><Label>Validity</Label><Input value={form.validity} onChange={(e) => set("validity", e.target.value)} /></div>
      <div><Label>Customer price *</Label><Input required type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} /></div>
      <div><Label>Agent price</Label><Input type="number" step="0.01" value={form.agent_price} onChange={(e) => set("agent_price", e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>GitHub repo (owner/repo)</Label><Input value={form.github_repo} onChange={(e) => set("github_repo", e.target.value)} placeholder="my-org/dataflow-pro" /><p className="text-xs text-muted-foreground mt-1">Set this to auto-publish release notes when the package is deployed.</p></div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
        <span className="text-sm text-muted-foreground">Available for sale</span>
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save package</Button>
      </div>
    </form>
  );
}