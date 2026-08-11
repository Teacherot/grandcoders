import React from "react";
import { Phone, MessageCircle } from "lucide-react";

// Builds a wa.me link from a Ghana number: strips non-digits and converts a
// leading 0 to the 233 country code.
const waLink = (phone) => {
  let d = String(phone || "").replace(/[^0-9]/g, "");
  if (d.startsWith("0")) d = "233" + d.slice(1);
  return `https://wa.me/${d}`;
};

export default function StoreContact({ agent }) {
  if (!agent?.phone) return null;
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Need help with an order?</p>
        <p className="text-sm font-medium text-foreground truncate">Contact {agent.full_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{agent.phone}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <a
          href={`tel:${agent.phone}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition"
        >
          <Phone className="w-4 h-4" /> Call
        </a>
        <a
          href={waLink(agent.phone)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
      </div>
    </div>
  );
}