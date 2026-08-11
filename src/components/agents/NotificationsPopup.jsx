import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { getNotificationsFromSupabase } from "@/lib/supabaseData";

const ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle };
const STYLE = {
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:border-blue-900 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200",
};
const SWIPE_THRESHOLD = 100;

function SwipeRow({ id, type, title, message, onDismiss }) {
  const Icon = ICON[type] || Info;
  return (
    <div className="relative">
      {/* delete hint revealed under the card while swiping */}
      <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-destructive/10 px-5">
        <span className="text-xs font-medium text-destructive/80">Swipe to clear</span>
      </div>
      <motion.div
        layout
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0.2 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -500) onDismiss();
        }}
        className={`relative flex gap-3 rounded-2xl border p-4 pr-11 shadow-sm touch-pan-y ${STYLE[type] || STYLE.info}`}
      >
        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-sm opacity-90 mt-0.5 whitespace-pre-wrap">{message}</p>
        </div>
        <button onClick={onDismiss} className="absolute top-2 right-2 p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 active:scale-95">
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}

export default function NotificationsPopup() {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dismissed_notifs") || "[]")); } catch { return new Set(); }
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const all = await getNotificationsFromSupabase().catch(() => []);
      if (!mounted) return;
      setItems((all || []).filter((n) => n.active !== false && !dismissed.has(n.id)).slice(0, 20));
    };

    load();
    const timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [dismissed]);

  const dismiss = (id) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem("dismissed_notifs", JSON.stringify([...next]));
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  if (!items.length) return null;

  return (
    <div className="space-y-3 mb-8">
      <AnimatePresence initial={false}>
        {items.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <SwipeRow id={n.id} type={n.type} title={n.title} message={n.message} onDismiss={() => dismiss(n.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}