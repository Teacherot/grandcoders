import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PackageForm from "@/components/packages/PackageForm";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import { nextCode } from "@/lib/shortCode";

const NETWORKS = ["All", "MTN", "Telecel", "AirtelTigo", "Other"];

export default function Packages() {
  const [packages, setPackages] = useState(null);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [network, setNetwork] = useState("All");
  const [toggling, setToggling] = useState(false);

  const load = () => base44.entities.Package.list("-created_date").then(setPackages);
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    if (editing) await base44.entities.Package.update(editing.id, data);
    else await base44.entities.Package.create({ ...data, code: await nextCode("Package", "P") });
    setOpen(false);
    setEditing(null);
    load();
  };

  const toggle = async (p, v) => { await base44.entities.Package.update(p.id, { active: v }); load(); };
  const remove = async (id) => { await base44.entities.Package.delete(id); load(); };

  const allActive = packages?.length ? packages.every((p) => p.active) : false;
  const setAllAvailable = async (v) => {
    if (!packages?.length) return;
    setToggling(true);
    try {
      await base44.entities.Package.bulkUpdate(packages.map((p) => ({ id: p.id, active: v })));
      await load();
    } finally { setToggling(false); }
  };

  const sorted = packages ? [...packages].sort((a, b) => (a.volume_gb || 0) - (b.volume_gb || 0)) : null;
  const filtered = sorted ? sorted.filter((p) => network === "All" || p.network === network) : null;

  return (
    <div>
      <PageHeader
        title="Packages"
        subtitle="Bundle catalog & agent pricing"
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />New package</Button>}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Switch checked={allActive} disabled={toggling || !packages} onCheckedChange={(v) => setAllAvailable(v)} />
          <Label className="text-sm text-foreground">Mark all packages available</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Network</Label>
          <select
            className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
          >
            {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {!packages ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-sm text-muted-foreground">
          No packages for this network.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className={`rounded-2xl border border-border bg-card p-6 shadow-sm transition-opacity ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.network}</p>
                  <p className="mt-1 font-medium tracking-tight text-foreground">{p.name}</p>
                  {p.code && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.code}</p>}
                </div>
                <Switch checked={!!p.active} onCheckedChange={(v) => toggle(p, v)} />
              </div>
              <p className="mt-5 text-3xl font-semibold tracking-tight text-foreground">GH₵ {Number(p.price || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {p.volume_gb ? `${p.volume_gb} GB · ` : ""}{p.validity || "No expiry"}
                {p.agent_price ? ` · agent GH₵ ${Number(p.agent_price).toFixed(2)}` : ""}
              </p>
              <div className="mt-5 flex justify-end gap-3 border-t border-border pt-4">
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="w-4 h-4" /></button>
                <button className="text-muted-foreground/60 hover:text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
          <PackageForm key={editing?.id || "new"} initial={editing} onSubmit={save} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}