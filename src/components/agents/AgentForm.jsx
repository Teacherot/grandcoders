import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const empty = { full_name: "", phone: "", email: "", region: "", commission_rate: 5, status: "active", notes: "" };

export default function AgentForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...empty, ...(initial || {}) });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sel = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground";

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, commission_rate: Number(form.commission_rate) }); }} className="grid gap-4 sm:grid-cols-2">
      <div><Label>Full name *</Label><Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
      <div><Label>Phone *</Label><Input required value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
      <div><Label>Region</Label><Input value={form.region} onChange={(e) => set("region", e.target.value)} /></div>
      <div><Label>Commission %</Label><Input type="number" step="0.1" value={form.commission_rate} onChange={(e) => set("commission_rate", e.target.value)} /></div>
      <div>
        <Label>Status</Label>
        <select className={sel} value={form.status} onChange={(e) => set("status", e.target.value)}>
          {["active", "suspended"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save agent</Button>
      </div>
    </form>
  );
}