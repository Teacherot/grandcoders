import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, X } from "lucide-react";
import { feeInclusiveTotal } from "@/lib/fee";

const cedi = (n) => `GHS ${Number(n || 0).toFixed(2)}`;

// The order form, rendered in place of the clicked bundle card (full row width
// inside the bundle grid). State is owned by the parent OrderTab so switching
// cards keeps the customer's typed details; only the selected card's bundle
// (p) changes.
export default function BundleForm({
  p,
  recipient,
  setRecipient,
  customer,
  setCustomer,
  email,
  setEmail,
  busy,
  payMsg,
  onSubmit,
  onClose,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="col-span-2 sm:col-span-3 rounded-2xl border-2 border-primary bg-card p-5 space-y-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{p.package_name}</p>
          <p className="text-sm text-muted-foreground">
            {cedi(feeInclusiveTotal(p.price))}{p.volume_gb ? ` · ${p.volume_gb} GB` : ""}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="w-3 h-3" /> Change
        </button>
      </div>
      <div><Label>Your name</Label><Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Optional" /></div>
      <div><Label>Email *</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" /></div>
      <div><Label>Recipient number *</Label><Input required value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0244XXXXXX" /></div>
      {payMsg && <p className="text-sm text-rose-600">{payMsg}</p>}
      <Button type="submit" className="w-full h-11 text-base" disabled={busy}>
        {busy ? "Please wait…" : `Pay ${cedi(feeInclusiveTotal(p.price))}`}
      </Button>
      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <ShieldCheck className="w-3 h-3" /> Secure payment via KoraPay · Mobile money
      </p>
      <p className="text-[11px] text-muted-foreground text-center">Price includes all charges — no hidden fees</p>
    </form>
  );
}