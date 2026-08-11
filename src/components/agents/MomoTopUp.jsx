import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Loader2, AlertCircle, Wallet } from "lucide-react";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function MomoTopUp() {
  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [txnId, setTxnId] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const load = async () => {
    setLoadingInfo(true);
    try {
      const res = await base44.functions.invoke("agentSelfService", {});
      setInfo(res?.data || null);
    } catch {
      /* ignore */
    } finally {
      setLoadingInfo(false);
    }
  };
  useEffect(() => { load(); }, []);

  const copyNumber = () => {
    const num = info?.admin_momo_number;
    if (num) {
      navigator.clipboard?.writeText(num);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const copyPhone = () => {
    const num = info?.agent_phone;
    if (num) {
      navigator.clipboard?.writeText(num);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1500);
    }
  };

  const claim = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!txnId.trim()) return;
    setClaiming(true);
    try {
      const res = await base44.functions.invoke("claimMomoTopup", { transaction_id: txnId.trim() });
      setResult(res?.data || null);
      setTxnId("");
      load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Could not verify that transaction.");
    } finally {
      setClaiming(false);
    }
  };

  const momoNumber = info?.admin_momo_number || "0244000000";
  const momoName = info?.admin_momo_name || "GrandCoders";
  const agentPhone = info?.agent_phone || "0244000000";
  const paymentReference = info?.agent_phone || "0244000000";

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#1E6FE8]" />
          <p className="text-sm font-medium">Top up wallet via Mobile Money</p>
        </div>
        {info && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-semibold">{cedi(info.balance)}</p>
          </div>
        )}
      </div>

      {loadingInfo ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !momoNumber ? (
        <p className="text-sm text-muted-foreground">Wallet top-up is being configured. Please check back shortly.</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">1. Send Mobile Money to this number</p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold tracking-tight">{momoNumber}</p>
                {momoName && <p className="text-xs text-muted-foreground mt-0.5">{momoName}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={copyNumber}>
                {copied ? <><Check className="w-3.5 h-3.5 mr-1.5" />Copied</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</>}
              </Button>
            </div>
          </div>

          {agentPhone ? (
            <div className="rounded-xl border border-[#1E6FE8]/30 bg-[#1E6FE8]/5 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">2. Use this as the payment reference</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight">{paymentReference}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Type this as the payment reference when sending for automatic credit.</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyPhone}>
                  {copiedPhone ? <><Check className="w-3.5 h-3.5 mr-1.5" />Copied</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</>}
                </Button>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" /> Your wallet is credited automatically — no transaction ID needed.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 p-4 text-sm text-amber-700 dark:text-amber-400">
              You need a registered phone number for automatic top-up. Add your number in <Link to="/settings" className="font-medium underline">Settings</Link> first.
            </div>
          )}

          <form onSubmit={claim} className="space-y-3">
            <div>
              <Label>Didn't auto-credit? Enter the MoMo transaction ID</Label>
              <Input
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                placeholder="e.g. 1234567890"
                disabled={claiming}
              />
              <p className="text-xs text-muted-foreground mt-1.5">Only needed if the automatic credit didn't go through.</p>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                Wallet credited with {cedi(result.amount)}. New balance: {cedi(result.new_balance)}.
              </div>
            )}

            <Button type="submit" disabled={claiming || !txnId.trim()} className="w-full">
              {claiming ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Credit my wallet"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}