import React from "react";

export const NETWORKS = {
  MTN: { label: "MTN", bg: "#FFCC00", text: "#1a1a1a" },
  Telecel: { label: "Telecel", bg: "#E60000", text: "#FFFFFF" },
  AirtelTigo: { label: "AirtelTigo", bg: "#E2231A", text: "#FFFFFF" },
  Other: { label: "Other", bg: "#64748B", text: "#FFFFFF" },
};

export default function NetworkBadge({ network, size = "sm" }) {
  const n = NETWORKS[network] || NETWORKS.Other;
  const pad = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-md font-bold tracking-tight ${pad}`}
      style={{ background: n.bg, color: n.text }}
    >
      {n.label}
    </span>
  );
}