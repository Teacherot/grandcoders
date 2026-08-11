import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2, Zap, Hand, Wallet, KeyRound, RefreshCw, Store, Scale, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "gmpl_auto_delivery";
const THRESHOLD_KEY = "wallet_low_balance_threshold";
const SIGNUP_KEY = "signup_token";
const STORES_KEY = "stores_paused";

export default function Settings() {
  const [val, setVal] = useState(null);
  const [recId, setRecId] = useState(null);
  const [threshold, setThreshold] = useState(null);
  const [thresholdId, setThresholdId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [signupToken, setSignupToken] = useState("");
  const [signupId, setSignupId] = useState(null);
  const [savingSignup, setSavingSignup] = useState(false);
  const [storesPaused, setStoresPaused] = useState(false);
  const [storesId, setStoresId] = useState(null);
  const [savingStores, setSavingStores] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  const load = async () => {
    const rows = await base44.entities.Setting.filter({ key: KEY });
    const r = rows[0];
    setRecId(r?.id || null);
    setVal(r ? r.value === "true" : true);

    const trows = await base44.entities.Setting.filter({ key: THRESHOLD_KEY });
    const t = trows[0];
    setThresholdId(t?.id || null);
    setThreshold(t ? Number(t.value) : 20);

    const srows = await base44.entities.Setting.filter({ key: SIGNUP_KEY });
    const s = srows[0];
    setSignupId(s?.id || null);
    setSignupToken(s ? s.value : "");

    const strows = await base44.entities.Setting.filter({ key: STORES_KEY });
    const st = strows[0];
    setStoresId(st?.id || null);
    setStoresPaused(st ? st.value === "true" : false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (next) => {
    setVal(next);
    setSaving(true);
    try {
      if (recId) await base44.entities.Setting.update(recId, { value: String(next) });
      else {
        const created = await base44.entities.Setting.create({ key: KEY, value: String(next), label: "Automatic GMPL delivery" });
        setRecId(created.id);
      }
    } catch (e) {
      setVal(!next);
    } finally {
      setSaving(false);
    }
  };

  const saveThreshold = async () => {
    const n = Math.max(0, Number(threshold) || 0);
    setThreshold(n);
    setSavingThreshold(true);
    try {
      if (thresholdId) await base44.entities.Setting.update(thresholdId, { value: String(n) });
      else {
        const created = await base44.entities.Setting.create({ key: THRESHOLD_KEY, value: String(n), label: "Low wallet balance threshold (GHS)" });
        setThresholdId(created.id);
      }
    } finally {
      setSavingThreshold(false);
    }
  };

  const saveSignup = async (value) => {
    const v = (value ?? signupToken ?? "").trim();
    setSignupToken(v);
    setSavingSignup(true);
    try {
      if (signupId) await base44.entities.Setting.update(signupId, { value: v });
      else {
        const created = await base44.entities.Setting.create({ key: SIGNUP_KEY, value: v, label: "Sign-up access token" });
        setSignupId(created.id);
      }
    } finally {
      setSavingSignup(false);
    }
  };

  const shuffleSignup = async () => {
    const random = "GC-" + Math.random().toString(36).slice(2, 8).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    await saveSignup(random);
  };

  const toggleStores = async (next) => {
    setStoresPaused(next);
    setSavingStores(true);
    try {
      if (storesId) await base44.entities.Setting.update(storesId, { value: String(next) });
      else {
        const created = await base44.entities.Setting.create({ key: STORES_KEY, value: String(next), label: "Pause all stores" });
        setStoresId(created.id);
      }
    } catch (e) {
      setStoresPaused(!next);
    } finally {
      setSavingStores(false);
    }
  };

  const runReconcile = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const res = await base44.functions.invoke("reconcileWallets", {});
      setReconcileResult(res.data || res);
    } catch (e) {
      setReconcileResult({ error: e.message || "Reconciliation failed" });
    } finally {
      setReconciling(false);
    }
  };

  if (val === null || threshold === null) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  }

  const auto = val;
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Control how orders are fulfilled and when agents are warned." />
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {auto ? <Zap className="w-4 h-4 text-primary" /> : <Hand className="w-4 h-4 text-amber-500" />}
              <h2 className="text-base font-semibold">Automatic delivery (Supplier API)</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {auto
                ? "On — new orders are pushed to your bundle supplier automatically."
                : "Off — orders stay pending for you to deliver manually."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Switch checked={auto} onCheckedChange={toggle} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold">Low wallet balance alert</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              When an agent's wallet drops below this amount (GHS), they're emailed a warning to top up before their next order is blocked. Set to 0 to turn the alert off.
            </p>
            <div className="flex items-center gap-2 mt-4 max-w-[200px]">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">GH₵</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  onBlur={saveThreshold}
                  className="pl-9"
                />
              </div>
              {savingThreshold && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold">Sign-up access token</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              New users must enter this token code before they can create an account. Share it only with people you want to allow to sign up.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <div className="max-w-[280px]">
                <Input
                  value={signupToken}
                  onChange={(e) => setSignupToken(e.target.value)}
                  onBlur={() => saveSignup()}
                  placeholder="Set a token code"
                />
              </div>
              <Button type="button" variant="outline" size="default" onClick={shuffleSignup} disabled={savingSignup}>
                {savingSignup ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generate
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold">Pause all stores</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {storesPaused
                ? "On — every agent storefront is hidden from customers and agents can't re-enable their own store."
                : "Off — agents control their own store visibility."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {savingStores && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Switch checked={storesPaused} onCheckedChange={toggleStores} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold">Wallet reconciliation</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Recomputes every agent's wallet balance from their full transaction history and corrects any drift caused by concurrent bulk orders. This also runs automatically every day at 1:00 AM UTC.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button type="button" onClick={runReconcile} disabled={reconciling}>
                {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                Reconcile now
              </Button>
            </div>
            {reconcileResult && (
              <div className="mt-4 rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                {reconcileResult.error ? (
                  <span className="text-destructive">{reconcileResult.error}</span>
                ) : (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">
                        Scanned {reconcileResult.scanned} wallets · corrected {reconcileResult.corrected_count}
                      </p>
                      {reconcileResult.corrected?.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-muted-foreground">
                          {reconcileResult.corrected.map((c) => (
                            <li key={c.agent_id}>
                              {c.agent}: GH₵{c.was.toFixed(2)} → <span className="font-medium text-foreground">GH₵{c.now.toFixed(2)}</span> ({c.delta > 0 ? "+" : ""}{c.delta.toFixed(2)})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}