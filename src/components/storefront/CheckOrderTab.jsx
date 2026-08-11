import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import NetworkBadge from "@/components/NetworkBadge";
import { Search, Copy, CheckCircle2, Receipt } from "lucide-react";
import { Image } from "@/components/ui/image";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const when = (d) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

// Look up an order two ways: by the short numeric Order ID printed on the
// checkout receipt, OR by the KoraPay transaction ID (reference) — the
// recovery path for when the payment screen broke and the customer never
// received an Order ID.
export default function CheckOrderTab() {
  const [mode, setMode] = useState("code"); // "code" | "ref"
  const [code, setCode] = useState("");
  const [ref, setRef] = useState("");
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recovered, setRecovered] = useState(false); // ref mode: highlight the Order ID
  const [copied, setCopied] = useState(false);

  const reset = () => { setOrders(null); setError(""); setRecovered(false); setCopied(false); };

  const searchByCode = async (e) => {
    e.preventDefault();
    const c = code.replace(/\D/g, "");
    if (!c) return;
    setLoading(true); reset();
    const res = await base44.functions.invoke("checkStorefrontOrder", { code: c });
    setOrders(res?.data?.orders || []);
    setLoading(false);
  };

  const verifyByRef = async (e) => {
    e.preventDefault();
    const reference = ref.trim();
    if (!reference) return;
    setLoading(true); reset();
    // KoraPay's charge can still read "processing" right after payment; poll a
    // couple of times before declaring failure (mirrors PayResult's behaviour).
    const ATTEMPTS = 3;
    const DELAYS = [3000, 4000];
    let result = null;
    try {
      for (let i = 0; i < ATTEMPTS; i++) {
        const v = await base44.functions.invoke("verifyStorefrontTransaction", { reference });
        const d = v?.data || {};
        if (d.ok && d.order) { result = d; break; }
        if (!d.retryable) { result = d; break; }
        result = d;
        if (i < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, DELAYS[i] || 4000));
      }
    } catch (err) {
      result = { error: err?.message || "Could not verify this transaction." };
    }
    if (result?.ok && result.order) {
      setOrders([result.order]);
      setRecovered(true);
    } else {
      setError(result?.error || "Could not verify this transaction.");
    }
    setLoading(false);
  };

  const switchMode = (m) => { setMode(m); reset(); setCode(""); setRef(""); };

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {[["code", "Order ID"], ["ref", "Transaction ID"]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => switchMode(k)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${mode === k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === "code" ? (
        <form onSubmit={searchByCode} className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="Enter your Order ID (e.g. 482913)"
          />
          <Button type="submit" disabled={loading}>{loading ? "Searching…" : <><Search className="w-4 h-4" /> Check</>}</Button>
        </form>
      ) : (
        <form onSubmit={verifyByRef} className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Paste your Transaction ID (e.g. DFP-…)"
            />
            <Button type="submit" disabled={loading}>{loading ? "Verifying…" : <><Receipt className="w-4 h-4" /> Verify</>}</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Payment screen closed before you got an Order ID? Enter the Transaction ID from your payment receipt to recover it.
          </p>
        </form>
      )}

      {loading && <p className="text-sm text-muted-foreground">Please wait…</p>}

      {!loading && error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      {!loading && orders !== null && orders.length === 0 && (
        <p className="text-sm text-muted-foreground">No order found for that ID. Check the number and try again.</p>
      )}

      {!loading && orders !== null && orders.length > 0 && (
        <div className="space-y-3">
          {recovered && orders[0]?.code && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-[11px] uppercase tracking-wider text-emerald-700">Your Order ID</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="text-2xl font-bold tracking-wider text-foreground font-mono">{orders[0].code}</span>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(orders[0].code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Save this ID to track your order here anytime.</p>
            </div>
          )}
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <NetworkBadge network={o.network} />
                  <span className="font-medium">{o.package_name}</span>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{cedi(o.amount)} · {o.recipient_number}</span>
                <span>{when(o.created_date)}</span>
              </div>
              {o.evidence_url && (
                <div className="mt-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Delivery evidence</p>
                  <a href={o.evidence_url} target="_blank" rel="noreferrer" className="block w-32 h-20 rounded-lg overflow-hidden border border-border bg-muted">
                    <Image src={o.evidence_url} alt="Evidence" className="block w-32 h-20" fittingType="fill" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}