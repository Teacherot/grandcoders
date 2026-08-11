import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import OrderTab from "@/components/storefront/OrderTab";
import CheckOrderTab from "@/components/storefront/CheckOrderTab";
import ReportTab from "@/components/storefront/ReportTab";
import StoreShareBar from "@/components/storefront/StoreShareBar";
import StoreContact from "@/components/storefront/StoreContact";
import PayResult from "@/components/storefront/PayResult";
import { ShieldCheck, Zap, MapPin, Info, CheckCircle2, AlertTriangle, Megaphone } from "lucide-react";

const slug = (s) => (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const NOTICE_STYLE = {
  info: { icon: Info, cls: "border-blue-200 bg-blue-50 text-blue-800", iconCls: "text-blue-500" },
  success: { icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-800", iconCls: "text-emerald-500" },
  warning: { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-800", iconCls: "text-amber-500" },
};

export default function Storefront() {
  const { slug: sl } = useParams();
  const [agent, setAgent] = useState(null);
  const [prices, setPrices] = useState([]);
  const [notices, setNotices] = useState([]);
  const [tab, setTab] = useState("order");
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    const loadNotices = () =>
      base44.entities.Notification
        .filter({ active: true })
        .then((n) => { if (alive) setNotices(n); })
        .catch(() => {});

    (async () => {
      const [storeRes, notifs, status] = await Promise.all([
        base44.functions.invoke("getPublicStore", { slug: sl }).catch(() => null),
        base44.entities.Notification.filter({ active: true }).catch(() => []),
        base44.functions.invoke("getStoreStatus", {}).catch(() => null),
      ]);
      if (!alive) return;
      setPaused(!!status?.data?.stores_paused);
      const s = storeRes?.data;
      if (s && s.agent) {
        setAgent(s.agent);
        setPrices(s.prices || []);
      }
      setNotices(notifs);
      setLoading(false);
    })();

    // Realtime live-updates for authenticated viewers. The storefront is public,
    // so an unauthenticated customer's tab may not receive realtime events —
    // a deleted notification would otherwise stay on screen until a reload.
    // Re-fetch on focus/visibility and on a gentle interval so deletes always
    // catch up without requiring the customer to refresh.
    const onVisibility = () => { if (!document.hidden) loadNotices(); };
    const onFocus = () => loadNotices();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    const timer = setInterval(loadNotices, 30000);

    const unsub = base44.entities.Notification.subscribe((ev) => {
      const ev2 = ev || {};
      setNotices((prev) => {
        if (ev2.type === "delete") return prev.filter((n) => n.id !== ev2.data?.id);
        const d = ev2.data;
        if (!d || d.active === false) return prev.filter((n) => n.id !== d.id);
        return prev.some((n) => n.id === d.id) ? prev.map((n) => (n.id === d.id ? d : n)) : [d, ...prev];
      });
    });

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
      if (unsub) unsub();
    };
  }, [sl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading store…</p>
        </div>
      </div>
    );
  }

  if (!agent || agent.store_active === false || paused) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground text-2xl font-bold">!</div>
        <h1 className="text-lg font-semibold text-foreground">Store unavailable</h1>
        <p className="text-sm text-muted-foreground mt-1">This store is not available right now.</p>
      </div>
    );
  }

  const theme = agent.store_theme && agent.store_theme !== "#171717" ? agent.store_theme : "#1E6FE8";

  const kpayRef = new URLSearchParams(window.location.search).get("kpay_ref");

  const tabs = [
    { id: "order", label: "Order data" },
    { id: "check", label: "Check order" },
    { id: "report", label: "Report issue" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden text-white" style={{ background: theme }}>
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 25% 15%, rgba(255,255,255,0.45), transparent 55%)" }} />
        <div className="absolute right-5 bottom-2 select-none pointer-events-none opacity-[0.07]">
          <span className="text-[42px] font-black tracking-tight leading-none">GrandCoders</span>
        </div>
        <div className="relative max-w-2xl mx-auto px-6 pt-6 pb-6">
          <div className="flex items-center gap-3">
            {agent.logo_url ? (
              <img src={agent.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/20" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-lg font-bold">
                {(agent.store_name || agent.full_name || "S").charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold tracking-tight leading-tight">{agent.store_name || agent.full_name}</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-0.5">Official Data Store</p>
            </div>
          </div>
          {agent.store_bio && <p className="text-sm opacity-90 mt-3 leading-relaxed max-w-xl">{agent.store_bio}</p>}
          <StoreShareBar agent={agent} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-white/75">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Secure ordering</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Instant delivery</span>
            {agent.region && <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {agent.region}</span>}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 relative mt-5 pb-10 space-y-4">
        {agent.store_notice && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
            <Megaphone className="w-5 h-5 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800">Store notice</p>
              <p className="text-sm text-amber-900/80 mt-0.5 whitespace-pre-line">{agent.store_notice}</p>
            </div>
          </div>
        )}

        {notices.map((n) => {
          const s = NOTICE_STYLE[n.type] || NOTICE_STYLE.info;
          const Icon = s.icon;
          return (
            <div key={n.id} className={`rounded-2xl border p-4 flex items-start gap-3 ${s.cls}`}>
              <Icon className={`w-5 h-5 shrink-0 ${s.iconCls}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-sm opacity-90 mt-0.5 whitespace-pre-line">{n.message}</p>
              </div>
            </div>
          );
        })}

        <div className="rounded-3xl bg-card shadow-xl border border-border p-5 sm:p-8">
          {kpayRef ? (
            <PayResult agent={agent} reference={kpayRef} />
          ) : (
            <>
              <div className="flex gap-1 rounded-xl bg-muted p-1 mb-6">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === t.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "order" && <OrderTab agent={agent} prices={prices} />}
              {tab === "check" && <CheckOrderTab agent={agent} />}
              {tab === "report" && <ReportTab agent={agent} />}
            </>
          )}
        </div>

        <StoreContact agent={agent} />

        <footer className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
          <span>Powered by</span>
          <img src="https://media.base44.com/images/public/6a7662b431db147eef96232e/d24c6ad57_generated_image.png" alt="GrandCoders" className="w-5 h-5 rounded object-cover ring-1 ring-border" />
          <span className="font-semibold text-foreground">GrandCoders</span>
        </footer>
      </div>
    </div>
  );
}