import React, { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createOrderInSupabase, getOrdersFromSupabase } from "@/lib/supabaseData";
import { nextCode } from "@/lib/shortCode";

// Handles the customer's return from KoraPay's hosted checkout. Reads the
// pending order meta from sessionStorage (saved before the redirect), verifies
// the charge via placeStorefrontOrder, and shows a success or error screen.
export default function PayResult({ agent, reference }) {
  const [state, setState] = useState({ verifying: true, order: null, error: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      let meta = null;
      try { meta = JSON.parse(sessionStorage.getItem("korapay_pending") || "null"); } catch {}
      try { sessionStorage.removeItem("korapay_pending"); } catch {}
      // Clean the payment reference from the URL.
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete("kpay_ref");
        window.history.replaceState({}, "", u.toString());
      } catch {}

      // If the session meta survived the redirect, finalize via the normal
      // path. If it's gone (closed tab, broken redirect, came back later),
      // recover the order from the server-stored pending meta using just the
      // KoraPay reference still in the URL — so a broken payment screen still
      // yields the customer's Order ID.
      const useRecovery = !meta;
      if (useRecovery) {
        try {
          const rows = await getOrdersFromSupabase().catch(() => []);
          const found = (rows || []).find((row) => {
            const raw = String(row.reference || row.payment_reference || "");
            return raw.toLowerCase().includes(String(reference || "").toLowerCase());
          });
          if (found) {
            setState({ verifying: false, order: found, error: "" });
            return;
          }
          setState({ verifying: false, order: null, error: "We couldn't confirm your payment. If you were charged, use the Check order tab with your Transaction ID." });
          return;
        } catch (err) {
          setState({ verifying: false, order: null, error: err?.message || "Something went wrong." });
          return;
        }
      }
      try {
        const created = await createOrderInSupabase({
          ...meta,
          source: "store",
          status: "pending",
          payment_reference: reference,
          reference: reference,
          code: await nextCode("Order", "O"),
          agent_id: agent?.id || "",
          agent_name: agent?.full_name || agent?.store_name || "",
          agent_email: agent?.email || "",
        });
        setState({ verifying: false, order: created, error: "" });
      } catch (err) {
        setState({ verifying: false, order: null, error: err?.message || "Something went wrong." });
      }
    })();
  }, [reference]);

  if (state.verifying) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
        <p className="text-sm text-muted-foreground mt-3">Please wait for about a minute…</p>
      </div>
    );
  }

  if (state.order) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
        <h2 className="text-lg font-semibold mt-3 text-foreground">Payment successful — order received!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {agent?.store_name || agent?.full_name} will deliver {state.order.package_name} to {state.order.recipient_number} shortly.
        </p>
        {state.order.code && (
          <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Your Order ID</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="text-2xl font-bold tracking-wider text-foreground font-mono">{state.order.code}</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(state.order.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Save this ID — use it on the "Check Order" tab to track your order anytime.</p>
          </div>
        )}
        <Button className="mt-5" onClick={() => { window.location.href = window.location.pathname; }}>Place another order</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <XCircle className="w-12 h-12 mx-auto text-rose-500" />
      <h2 className="text-lg font-semibold mt-3 text-foreground">Payment could not be confirmed</h2>
      <p className="text-sm text-muted-foreground mt-1">{state.error}</p>
      <Button className="mt-5" variant="outline" onClick={() => { window.location.href = window.location.pathname; }}>Back to store</Button>
    </div>
  );
}