import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Trash2 } from "lucide-react";
import { createNotificationInSupabase, deleteNotificationInSupabase, getNotificationsFromSupabase, updateNotificationInSupabase } from "@/lib/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import { format } from "date-fns";

const TYPE_STYLE = {
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300",
};

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const rows = await getNotificationsFromSupabase();
    setItems(rows);
  };
  useEffect(() => { load(); }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSaving(true);
    try {
      await createNotificationInSupabase({ title: title.trim(), message: message.trim(), type, active: true });
      setTitle(""); setMessage(""); setType("info");
      load();
    } finally { setSaving(false); }
  };

  const toggle = async (n) => { await updateNotificationInSupabase(n.id, { active: !n.active }); load(); };
  const remove = async (id) => { await deleteNotificationInSupabase(id); load(); };

  const selCls = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground";

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Broadcast updates that pop up on every agent dashboard" />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={send} className="rounded-2xl border border-border bg-card p-6 space-y-4 h-fit shadow-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Compose broadcast</p>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New MTN packages added" required />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write the update agents will see…" required />
          </div>
          <div>
            <Label>Type</Label>
            <select className={selCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          <Button type="submit" disabled={saving} className="w-full"><Send className="w-4 h-4 mr-2" />{saving ? "Sending…" : "Send to all agents"}</Button>
        </form>

        <div className="space-y-3">
          {!items ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">No notifications sent yet.</div>
          ) : items.map((n) => (
            <div key={n.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs capitalize ${TYPE_STYLE[n.type] || TYPE_STYLE.info}`}>{n.type}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${n.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{n.active ? "Active" : "Hidden"}</span>
                  </div>
                  <p className="font-semibold mt-2 text-foreground">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{n.created_date ? format(new Date(n.created_date), "MMM d, yyyy HH:mm") : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => toggle(n)}>{n.active ? "Hide" : "Show"}</button>
                  <button className="text-muted-foreground/60 hover:text-destructive" onClick={() => remove(n.id)}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}