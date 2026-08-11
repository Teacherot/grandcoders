import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export function buildAgentOptions(packages, prices) {
  return (packages || [])
    .filter((p) => p.active !== false)
    .map((p) => {
      const base = Number(p.agent_price ?? p.price);
      const ap = (prices || []).find((x) => x.package_id === p.id && x.active);
      // Sell price is the agent's custom price, but never below the admin base price.
      const raw = ap ? Number(ap.price) : base;
      const price = Number.isFinite(raw) && raw >= base ? raw : base;
      // `cost` is what the platform charges the agent's wallet (the base price);
      // `price` is what the agent charges the customer (sell price).
      return { id: p.id, name: p.name, network: p.network, volume_gb: p.volume_gb, price, cost: base };
    });
}

export default function AgentOrderForm({ packages, prices, onSubmit, onCancel }) {
  const options = useMemo(() => buildAgentOptions(packages, prices), [packages, prices]);
  const [pkgId, setPkgId] = useState(options[0]?.id || "");
  const [recipient, setRecipient] = useState("");
  const [customer, setCustomer] = useState("");
  const [saving, setSaving] = useState(false);

  // Packages load asynchronously after the dialog opens; sync the selected
  // package to the first available option once the list arrives, otherwise the
  // Place order button stays disabled even though a package appears selected.
  useEffect(() => {
    if ((!pkgId || !options.some((o) => o.id === pkgId)) && options.length) {
      setPkgId(options[0].id);
    }
  }, [options, pkgId]);

  const sel = options.find((o) => o.id === pkgId);

  const submit = async (e) => {
    e.preventDefault();
    if (!sel || !recipient.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        recipient_number: recipient.trim(),
        customer_name: customer.trim(),
        network: sel.network,
        package_name: sel.name,
        volume_gb: sel.volume_gb,
        amount: sel.cost,
        payment_method: "wallet",
        status: "pending",
      });
    } finally {
      setSaving(false);
    }
  };

  const selCls = "h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground w-full";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Package</Label>
        <select className={selCls} value={pkgId} onChange={(e) => setPkgId(e.target.value)} disabled={!options.length}>
          {!options.length && <option value="">No packages available</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name} · {o.network} — {cedi(o.cost)}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Recipient number</Label>
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="024XXXXXXX" required />
        </div>
        <div>
          <Label>Customer name (optional)</Label>
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">Wallet charge: <span className="font-medium text-foreground">{cedi(sel?.cost)}</span></p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={saving || !sel || !recipient.trim()}>{saving ? "Placing…" : "Place order"}</Button>
        </div>
      </div>
    </form>
  );
}