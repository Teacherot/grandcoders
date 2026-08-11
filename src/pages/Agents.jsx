import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Pencil, Phone, Mail, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import AgentForm from "@/components/agents/AgentForm";
import WalletTopUp from "@/components/agents/WalletTopUp";
import { nextCode } from "@/lib/shortCode";
import { createAgentInSupabase, deleteAgentInSupabase, getAgentWalletsFromSupabase, getAgentsFromSupabaseLive, updateAgentInSupabase } from "@/lib/supabaseData";

export default function Agents() {
  const [agents, setAgents] = useState(null);
  const [orders, setOrders] = useState([]);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [topUp, setTopUp] = useState(null);
  const [wallets, setWallets] = useState({});

  const load = async () => {
    const list = await getAgentsFromSupabaseLive();
    setAgents(list);
  };
  const loadWallets = async () => {
    const w = await getAgentWalletsFromSupabase();
    const map = {};
    (w || []).forEach((x) => { map[x.agent_id] = x; });
    setWallets(map);
  };

  useEffect(() => {
    load();
    loadWallets();
    base44.entities.Order.list("-created_date", 500).then(setOrders);
  }, []);

  const save = async (data) => {
    try {
      if (editing) {
        await updateAgentInSupabase(editing.id, data);
      } else {
        const payload = { ...data, code: await nextCode("Agent", "A") };
        console.log('Creating agent via Supabase', payload);
        const result = await createAgentInSupabase(payload);
        console.log('Agent create result', result);
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      console.error('Agent save failed', error);
      alert(error?.message || 'Unable to save agent.');
    }
  };

  const remove = async (id) => { await deleteAgentInSupabase(id); load(); };

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Your resellers and their performance"
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add agent</Button>}
      />

      {!agents ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center text-sm text-muted-foreground">No agents yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => {
            const mine = orders.filter((o) => o.agent_id === a.id);
            const sales = mine.reduce((s, o) => s + (o.amount || 0), 0);
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium tracking-tight text-foreground">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.region || "—"}{a.code ? ` · ${a.code}` : ""}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{a.phone}</p>
                  {a.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{a.email}</p>}
                </div>
                <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{mine.length} orders · {a.commission_rate ?? 0}% commission</p>
                    <p className="text-lg font-semibold tracking-tight text-foreground">GH₵ {sales.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Wallet: GH₵ {Number(wallets[a.id]?.balance || 0).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-3">
                    <button className="text-muted-foreground hover:text-foreground" title="Top up wallet" onClick={() => setTopUp(a)}><Wallet className="w-4 h-4" /></button>
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="w-4 h-4" /></button>
                    <button className="text-muted-foreground/60 hover:text-destructive" onClick={() => remove(a.id)}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit agent" : "Add agent"}</DialogTitle></DialogHeader>
          <AgentForm key={editing?.id || "new"} initial={editing} onSubmit={save} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!topUp} onOpenChange={(v) => { if (!v) setTopUp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Top up wallet — {topUp?.full_name}</DialogTitle></DialogHeader>
          {topUp && <WalletTopUp agent={topUp} onClose={() => { setTopUp(null); loadWallets(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}