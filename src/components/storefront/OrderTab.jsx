import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { NetworkMark } from "@/components/storefront/NetworkLogo";
import BundleCard from "@/components/storefront/BundleCard";
import BundleForm from "@/components/storefront/BundleForm";

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
      setPayMsg("Enter a valid Ghana mobile number (e.g. 0244XXXXXX).");
      return;
    }
    setBusy(true);
    setPayMsg("Checking availability…");
    const orderMeta = {
      store_slug: agent.store_slug,
      package_name: p.package_name,
      network: p.network,
      volume_gb: p.volume_gb,
      amount: p.price,
      recipient_number: recipient,
      customer_name: customer,
    };
    try {
      const stockRes = await base44.functions.invoke("checkGmplStock", { network: p.network, volume_gb: p.volume_gb });
      const stock = stockRes?.data;
      if (stock && !stock.available) {
        setPayMsg(stock.reason || "This bundle is out of stock right now. Please try again later.");
        setBusy(false);
        return;
      }
      setPayMsg("");
      const returnUrl = window.location.origin + window.location.pathname;
      const res = await base44.functions.invoke("initializeKorapayCharge", { email, order: orderMeta, return_url: returnUrl });
      const data = res?.data;
      if (!data?.checkout_url) {
        setPayMsg(data?.error || "Could not start payment. Please try again.");
        setBusy(false);
        return;
      }
      try { sessionStorage.setItem("korapay_pending", JSON.stringify(orderMeta)); } catch {}
      // Redirect to KoraPay's hosted checkout. On return, the storefront
      // detects the kpay_ref query param and shows the payment result.
      window.location.href = data.checkout_url;
    } catch (err) {
      setPayMsg(err?.message || "Payment failed to start.");
      setBusy(false);
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
        <div className="grid grid-cols-3 gap-3">
          {nets.map((n) => {
            const active = net === n;
            return (
              <button
                type="button"
                key={n}
                onClick={() => setNet(active ? "" : n)}
                className={`relative rounded-2xl overflow-hidden aspect-square transition ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "ring-1 ring-border"}`}
              >
                <NetworkMark network={n} />
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
                payMsg={payMsg}
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