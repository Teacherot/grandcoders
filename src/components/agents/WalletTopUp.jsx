import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function WalletTopUp({ agent, onClose }) {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    let list = await base44.entities.AgentWallet.filter({ agent_id: agent.id });
    let w = list && list[0];
    if (!w) {
      w = await base44.entities.AgentWallet.create({
        agent_id: agent.id,
        agent_name: agent.full_name,
        balance: 0,
        api_key: "dfp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24),
      });
    }
    setWallet(w);
  };

  useEffect(() => {
    if (agent?.id) load();
  }, [agent?.id]);

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      const balanceAfter = Number(wallet.balance || 0) + amt;
      await base44.entities.AgentWallet.update(wallet.id, { balance: balanceAfter });
      await base44.entities.WalletTransaction.create({
        agent_id: agent.id,
        agent_name: agent.full_name,
        type: "top_up",
        amount: amt,
        balance_after: balanceAfter,
        notes,
      });
      await load();
      setAmount("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  };

  if (!wallet) return <p className="text-sm text-muted-foreground">Loading wallet…</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-muted/50 border border-border p-4">
        <p className="text-xs text-muted-foreground">Current balance</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{cedi(wallet.balance)}</p>
      </div>
      <div>
        <Label>Top-up amount (GH₵) *</Label>
        <Input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50" />
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add funds"}</Button>
      </div>
    </form>
  );
}