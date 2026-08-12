import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { NetworkMark } from "@/components/storefront/NetworkLogo";
import BundleCard from "@/components/storefront/BundleCard";
import BundleForm from "@/components/storefront/BundleForm";
import { createOrderInSupabase } from "@/lib/supabaseData";
import { nextCode } from "@/lib/shortCode";

// Ghana mobile: 10 digits starting 0 (e.g. 0244XXXXXX), or 233 + 9 digits.
const validGhNumber = (n) => {
  const d = String(n || "").replace(/[^0-9]/g, "");
  return /^(0\d{9}|233\d{9})$/.test(d);
};

export default function OrderTab({ agent, prices }) {
  const [sel, setSel] = useState("");
  const [recipient, setRecipient] = useState("");
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [payMsg, setPayMsg] = useState("");
  const [payStatus, setPayStatus] = useState("idle");
  const [lastOrderCode, setLastOrderCode] = useState("");
  const [copiedOrderCode, setCopiedOrderCode] = useState(false);
  const [query, setQuery] = useState("");

  const nets = useMemo(() => Array.from(new Set(prices.map((p) => p.network))), [prices]);
  const [net, setNet] = useState("");

  useEffect(() => { setSel(""); setNet(nets[0] || ""); }, [prices, nets]);

  const filtered = prices.filter((p) => {
    const okNet = !net || p.network === net;
    const q = query.trim().toLowerCase();
    const okQ = !q || `${p.volume_gb}GB`.toLowerCase().includes(q) || (p.package_name || "").toLowerCase().includes(q);
    return okNet && okQ;
  });

  if (!prices.length) return <p className="text-sm text-muted-foreground text-center py-8">No bundles available right now.</p>;

  const chosen = prices.find((x) => x.id === sel);

  const order = async (e) => {
    e.preventDefault();
    const p = chosen;
    if (!p || !recipient || !email) return;
    if (!validGhNumber(recipient)) {
      setPayStatus("error");
      setPayMsg("Enter a valid Ghana mobile number (e.g. 0244XXXXXX).");
      return;
    }
    setBusy(true);
    setPayStatus("info");
    setLastOrderCode("");
    setPayMsg("Placing order…");
    const orderMeta = {
      store_slug: agent.store_slug,
      package_name: p.package_name,
      network: p.network,
      volume_gb: p.volume_gb,
      amount: p.price,
      recipient_number: recipient,
      customer_name: customer,
      customer_email: email,
    };
    try {
      const created = await createOrderInSupabase({
        ...orderMeta,
        code: await nextCode("Order", "O"),
        source: "store",
        status: "pending",
        agent_id: agent.id,
        agent_name: agent.full_name || agent.store_name || "",
        agent_email: agent.email || "",
        payment_method: "momo",
        reference: `STORE-${Date.now()}`,
      });
      const code = created?.code || "";
      setLastOrderCode(code);
      setPayStatus("success");
      setPayMsg("Order placed successfully. Save your Order ID to track status anytime.");
    } catch (err) {
      setPayStatus("error");
      setLastOrderCode("");
      setPayMsg(err?.message || "Payment failed to start.");
    } finally {
      setBusy(false);
    }
  };

  const copyOrderCode = async () => {
    if (!lastOrderCode) return;
    try {
      await navigator.clipboard?.writeText(lastOrderCode);
      setCopiedOrderCode(true);
      setTimeout(() => setCopiedOrderCode(false), 1500);
    } catch {
      setCopiedOrderCode(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search size or offer (e.g. 5GB)"
          className="pl-9 h-11"
        />
      </div>

      {nets.length > 1 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {nets.map((n) => {
            const active = net === n;
            return (
              <button
                type="button"
                key={n}
                onClick={() => setNet(active ? "" : n)}
                className={`relative h-16 sm:h-20 rounded-xl overflow-hidden transition ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "ring-1 ring-border"}`}
              >
                <NetworkMark network={n} compact />
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">All prices include charges — no hidden fees</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-start">
        {filtered.map((p) => {
          const selected = sel === p.id;
          if (selected) {
            return (
              <BundleForm
                key={p.id}
                p={p}
                recipient={recipient}
                setRecipient={setRecipient}
                customer={customer}
                setCustomer={setCustomer}
                email={email}
                setEmail={setEmail}
                busy={busy}
                payStatus={payStatus}
                payMsg={payMsg}
                lastOrderCode={lastOrderCode}
                copiedOrderCode={copiedOrderCode}
                onCopyOrderCode={copyOrderCode}
                onSubmit={order}
                onClose={() => setSel("")}
              />
            );
          }
          return <BundleCard key={p.id} p={p} selected={false} onSelect={() => setSel(p.id)} />;
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No bundles match your search.</p>
      )}
    </div>
  );
}