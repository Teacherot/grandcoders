import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Check } from "lucide-react";
import { format } from "date-fns";
import AgentApiDocs from "@/components/agents/AgentApiDocs";

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default function AgentApi() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regen, setRegen] = useState(false);
  const [copied, setCopied] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("agentSelfService", {});
      setData(res?.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const endpoint = `${window.location.origin}/functions/agentApi`;
  const apiKey = data?.api_key || "";
  const apiKeyMasked = data?.api_key_masked || "dfp_••••••••••••";
  const expiresAt = data?.api_key_expires_at;
  const keyExpired = data?.api_key_expired;
  const expiringSoon = expiresAt && !keyExpired && (new Date(expiresAt) - new Date() < 14 * 86400000);

  const copy = (txt, key) => {
    navigator.clipboard?.writeText(txt);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  const regenerate = async () => {
    if (!confirm("Regenerate API key? The old key will stop working immediately.")) return;
    setRegen(true);
    try {
      const res = await base44.functions.invoke("agentSelfService", { action: "regenerateKey" });
      setData(res?.data || null);
    } finally {
      setRegen(false);
    }
  };

  return (
    <div>
      <PageHeader title="Agent API" subtitle="Connect your own systems to place and track orders programmatically" />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No agent account found for this user.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Wallet balance</p>
              <p className="text-3xl font-semibold tracking-tight mt-1 text-foreground">{cedi(data.balance)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">API key</p>
              {apiKey ? (
                <>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 truncate rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-foreground break-all">{apiKey}</code>
                    <Button size="icon" variant="outline" onClick={() => copy(apiKey, "key")}>
                      {copied === "key" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="outline" onClick={regenerate} disabled={regen} title="Regenerate key">
                      <RefreshCw className={`w-4 h-4 ${regen ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="text-[11px] text-amber-600 mt-2">Copy this key now — it won't be shown again.</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{apiKeyMasked}</code>
                    <Button size="icon" variant="outline" onClick={regenerate} disabled={regen} title="Regenerate key">
                      <RefreshCw className={`w-4 h-4 ${regen ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Hidden for security. Regenerate to reveal a new key.</p>
                </>
              )}
              {(keyExpired || expiringSoon) && (
                <p className={`text-[11px] mt-2 ${keyExpired ? "text-rose-600" : "text-amber-600"}`}>
                  {keyExpired
                    ? "This key has expired. Regenerate it to keep using the API."
                    : `Expires ${format(new Date(expiresAt), "MMM d, yyyy")} — regenerate soon.`}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Endpoint</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs text-foreground">{endpoint}</code>
              <Button size="icon" variant="outline" onClick={() => copy(endpoint, "ep")}>
                {copied === "ep" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Send a POST request with your API key in the <code className="text-foreground">x-api-key</code> header.</p>
          </div>

          <AgentApiDocs endpoint={endpoint} apiKey={apiKey || apiKeyMasked} />

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Recent wallet activity</p>
            {!data.transactions || data.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium capitalize text-foreground">{t.type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{t.created_date ? format(new Date(t.created_date), "MMM d, HH:mm") : ""}{t.notes ? ` · ${t.notes}` : ""}</p>
                    </div>
                    <span className={t.type === "top_up" ? "text-emerald-600 font-medium" : "text-foreground"}>
                      {t.type === "top_up" ? "+" : ""}{cedi(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}