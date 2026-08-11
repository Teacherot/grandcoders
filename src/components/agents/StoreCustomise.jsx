import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { Copy, Check, Lock } from "lucide-react";

const slug = (s) => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function StoreCustomise({ agent, onSave }) {
  const [form, setForm] = useState({});
  const [copied, setCopied] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setForm({
      store_name: agent.store_name || agent.full_name,
      store_slug: agent.store_slug || slug(agent.full_name),
      store_bio: agent.store_bio || "",
      store_notice: agent.store_notice || "",
      store_theme: agent.store_theme || "hsl(var(--foreground))",
      store_active: agent.store_active !== false,
      logo_url: agent.logo_url || "",
    });
  }, [agent.id]);

  useEffect(() => {
    base44.functions.invoke("getStoreStatus", {}).then((r) => setPaused(!!r?.data?.stores_paused)).catch(() => setPaused(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    await base44.entities.Agent.update(agent.id, { ...form, store_active: paused ? false : form.store_active });
    onSave();
  };

  const shareUrl = `${window.location.origin}/store/${form.store_slug}`;
  const copy = () => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <div><Label>Store name</Label><Input value={form.store_name || ""} onChange={(e) => set("store_name", e.target.value)} /></div>
        <div><Label>Store link (slug)</Label><Input value={form.store_slug || ""} onChange={(e) => set("store_slug", slug(e.target.value))} /></div>
        <div><Label>Store description</Label><Textarea rows={3} value={form.store_bio || ""} onChange={(e) => set("store_bio", e.target.value)} placeholder="Describe your store, what you offer, delivery speed, etc." /></div>
        <div><Label>Store notice</Label><Textarea rows={2} value={form.store_notice || ""} onChange={(e) => set("store_notice", e.target.value)} placeholder="Show a notice on your store, e.g. 'MTN deliveries may take up to 30 mins today.'" /></div>
        <div><Label>Theme colour</Label><input type="color" value={form.store_theme || "hsl(var(--foreground))"} onChange={(e) => set("store_theme", e.target.value)} className="h-10 w-16 rounded border border-input bg-card" /></div>
        <div><Label>Logo URL (optional)</Label><Input value={form.logo_url || ""} onChange={(e) => set("logo_url", e.target.value)} /></div>
        {paused ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 p-3 text-sm text-amber-700 dark:text-amber-400">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>All stores are paused by the admin. Your storefront is hidden until the pause is lifted.</span>
          </div>
        ) : (
          <div className="flex items-center gap-3"><Switch checked={!!form.store_active} onCheckedChange={(v) => set("store_active", v)} /><span className="text-sm text-muted-foreground">Store visible to customers</span></div>
        )}
        <Button onClick={save}>Save store settings</Button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Shareable link</p>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground truncate flex-1">{shareUrl}</span>
          <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
        </div>
        <div className="mt-6 rounded-2xl p-6 text-white" style={{ background: form.store_theme || "hsl(var(--foreground))" }}>
          <p className="text-lg font-semibold">{form.store_name || "My store"}</p>
          <p className="text-sm opacity-80 mt-1">{form.store_bio || "Fast, affordable data bundles."}</p>
        </div>
      </div>
    </div>
  );
}