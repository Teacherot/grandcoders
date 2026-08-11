import React from "react";
import { CheckCircle2 } from "lucide-react";
import { NETWORK_BRAND } from "@/components/storefront/NetworkLogo";
import { feeInclusiveTotal } from "@/lib/fee";

const cedi = (n) => `GHS ${Number(n || 0).toFixed(2)}`;

// Display state of a storefront bundle card. When selected it is replaced by
// <BundleForm/> in the parent grid, so this only renders the un-selected card.
export default function BundleCard({ p, selected, onSelect }) {
  const b = NETWORK_BRAND[p.network] || NETWORK_BRAND.Other;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative text-left rounded-2xl p-4 text-white transition overflow-hidden shadow-sm h-full"
      style={{
        background: `linear-gradient(135deg, ${b.grad[0]}, ${b.grad[1]})`,
        border: selected ? "2px solid hsl(var(--primary))" : "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <span
        className="pointer-events-none absolute -right-2 -bottom-3 font-black tracking-tight opacity-20"
        style={{ fontSize: 56, lineHeight: 1, fontFamily: "Inter, sans-serif" }}
      >
        {p.network === "MTN" ? "MTN" : b.label}
      </span>
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide bg-white/25 rounded px-1.5 py-0.5">{p.network}</span>
        {selected && <CheckCircle2 className="w-5 h-5 text-white drop-shadow" />}
      </div>
      <p className="relative text-2xl font-extrabold mt-3" style={{ fontFamily: "Inter, sans-serif" }}>{p.volume_gb}GB</p>
      <p className="relative text-sm font-medium opacity-95">{cedi(feeInclusiveTotal(p.price))}</p>
    </button>
  );
}