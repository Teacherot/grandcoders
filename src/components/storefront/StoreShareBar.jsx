import React, { useState } from "react";
import { MessageCircle, Share2, Copy, Check } from "lucide-react";

export default function StoreShareBar({ agent }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `Check out ${agent.store_name || agent.full_name}'s data bundles: ${url}`;

  const share = (href) => window.open(href, "_blank", "noopener,noreferrer");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const btn = "inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-2.5 py-1 text-xs font-medium text-white transition";

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3">
      <button className={btn} onClick={() => share(`https://wa.me/?text=${encodeURIComponent(text)}`)}><MessageCircle className="w-3.5 h-3.5" />WhatsApp</button>
      <button className={btn} onClick={() => share(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}><Share2 className="w-3.5 h-3.5" />Facebook</button>
      <button className={btn} onClick={() => share(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`)}><Share2 className="w-3.5 h-3.5" />X</button>
      <button className={btn} onClick={copy}>{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}