import React from "react";

// Brand-accurate network marks for the storefront. Self-contained (inline,
// no external image deps) so logos never break on slow networks.
export const NETWORK_BRAND = {
  MTN: { bg: "#FFCC00", fg: "#E4002B", label: "MTN", grad: ["#FFD24D", "#C99A00"] },
  AirtelTigo: { bg: "#1267E0", fg: "#FFFFFF", label: "AT", grad: ["#1E88E5", "#0D47A1"] },
  Telecel: { bg: "#E60000", fg: "#FFFFFF", label: "telecel", grad: ["#EF2B2B", "#A30000"] },
  Other: { bg: "#64748B", fg: "#FFFFFF", label: "Other", grad: ["#94A3B8", "#475569"] },
};

// Big branded logo that fills a network selector card.
export function NetworkMark({ network }) {
  const b = NETWORK_BRAND[network] || NETWORK_BRAND.Other;
  if (network === "MTN") {
    return (
      <div className="flex items-center justify-center w-full h-full" style={{ background: b.bg }}>
        <span
          className="px-4 py-1 rounded-full border-[3px] italic font-black tracking-tight"
          style={{ borderColor: b.fg, color: b.fg, fontSize: 26, fontFamily: "Inter, sans-serif" }}
        >
          MTN
        </span>
      </div>
    );
  }
  const word = network === "AirtelTigo" ? "airteltigo" : network === "Telecel" ? "telecel" : b.label;
  return (
    <div className="flex items-center justify-center w-full h-full" style={{ background: b.bg }}>
      <span
        className="font-extrabold tracking-tight text-white"
        style={{ fontSize: network === "AirtelTigo" ? 18 : 24, textTransform: "lowercase", fontFamily: "Inter, sans-serif" }}
      >
        {word}
      </span>
    </div>
  );
}

export default function NetworkLogo({ network, size = "md" }) {
  const b = NETWORK_BRAND[network] || NETWORK_BRAND.Other;
  const heights = { sm: 22, md: 26, lg: 34 };
  const h = heights[size] || 26;
  const fs = size === "sm" ? 10 : size === "lg" ? 15 : 12;
  return (
    <span
      className="inline-flex items-center justify-center rounded-md font-extrabold tracking-tight select-none"
      style={{ background: b.bg, color: b.fg, height: h, padding: `0 ${Math.round(h * 0.38)}px`, fontSize: fs, lineHeight: 1, fontFamily: "Inter, sans-serif" }}
    >
      {b.label}
    </span>
  );
}