import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function StorePrices({ agent }) {
  const { toast } = useToast();
  const [packages, setPackages] = useState([]);
  const [prices, setPrices] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    (async () => {
      const pkgs = (await base44.entities.Package.list()).filter((p) => p.active !== false);
      const ap = await base44.entities.AgentPrice.filter({ agent_id: agent.id });
      setPackages(pkgs);
      setPrices(ap);
      const d = {};
      pkgs.forEach((p) => {
        const existing = ap.find((x) => x.package_id === p.id);
        d[p.id] = { price: existing?.price ?? p.agent_price ?? p.price, active: existing?.active !== false };
      });
      setDrafts(d);
    })();
  }, [agent.id]);

  const set = (pid, k, v) => setDrafts((d) => ({ ...d, [pid]: { ...d[pid], [k]: v } }));

  const save = async (p) => {
    const draft = drafts[p.id];
    const base = p.agent_price ?? p.price;
    if (Number(draft.price) < Number(base)) {
      toast({ title: "Price too low", description: `Sell price can't be below the base price of GH₵ ${Number(base).toFixed(2)}.`, variant: "destructive" });
      return;
    }
    setSaving(p.id);
    try {
      // Routed through agentSelfService so the server enforces storefront-wide
      // rules (e.g. 1GB is disabled) — agents can't bypass it with a direct write.
      const res = await base44.functions.invoke("agentSelfService", { action: "savePrice", package_id: p.id, price: Number(draft.price), active: draft.active });
      const data = res?.data;
      if (!data?.ok) {
        toast({ title: "Couldn't save", description: data?.error || "Please try again.", variant: "destructive" });
        setSaving(null);
        return;
      }
      const saved = data.price;
      setPrices((prev) => {
        const idx = prev.findIndex((x) => x.package_id === p.id);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = saved; return copy; }
        return [...prev, saved];
      });
      toast({ title: "Price saved" });
    } catch (e) {
      toast({ title: "Couldn't save", description: e?.message || "Please try again.", variant: "destructive" });
    }
    setSaving(null);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((p) => {
        const d = drafts[p.id] || {};
        const cost = p.agent_price ?? p.price;
        const profit = (Number(d.price) || 0) - (cost || 0);
        const tooLow = d.price !== "" && d.price != null && Number(d.price) < Number(cost);
        return (
          <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.network} · {p.volume_gb || "-"} GB</p>
              </div>
              <Switch checked={!!d.active} onCheckedChange={(v) => set(p.id, "active", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Your cost</p>
                <p className="text-foreground">GH₵ {Number(cost || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Profit</p>
                <p className="text-emerald-600">+GH₵ {profit.toFixed(2)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sell price <span className="text-foreground/70">(min GH₵ {Number(cost || 0).toFixed(2)})</span></p>
              <Input type="number" step="0.01" min={cost || 0} value={d.price ?? ""} onChange={(e) => set(p.id, "price", e.target.value)} className={tooLow ? "border-rose-400 focus-visible:ring-rose-400" : ""} />
              {tooLow && <p className="text-xs text-rose-500 mt-1">Can't be below the base price</p>}
            </div>
            <Button size="sm" variant="outline" disabled={saving === p.id || tooLow || d.price === "" || d.price == null} onClick={() => save(p)} className="w-full">
              {saving === p.id ? "Saving…" : "Save"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}