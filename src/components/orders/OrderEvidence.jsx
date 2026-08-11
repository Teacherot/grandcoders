import React, { useRef } from "react";
import { format } from "date-fns";
import html2canvas from "html2canvas";

const normalizeGh = (n) => {
  if (!n) return "—";
  const s = String(n).replace(/\s+/g, "");
  if (s.startsWith("+233")) return s.slice(1);
  if (s.startsWith("233")) return s;
  if (s.startsWith("0")) return "233" + s.slice(1);
  return s;
};

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return `${format(dt, "do")}, ${format(dt, "MMM")}. ${format(dt, "yyyy")} ${format(dt, "hh:mm a")}`;
};

export default function OrderEvidence({ order: o }) {
  const ref = useRef(null);
  const number = normalizeGh(o.recipient_number);
  const dataBundle = o.volume_gb ? `${o.volume_gb} GB` : "—";
  const delivered = o.status === "completed" ? "Yes" : "No";
  const date = fmtDate(o.status === "completed" ? o.updated_date : o.updated_date || o.created_date);

  const download = async (e) => {
    e.stopPropagation();
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `evidence-${o.code || o.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const cell = "px-4 py-3 text-sm text-[#4A4A4A] whitespace-nowrap";
  const div = "border-r border-[#E0E0E0] last:border-r-0";

  return (
    <div className="mx-auto max-w-3xl">
      <div
        ref={ref}
        onClick={download}
        role="button"
        title="Click to download as image"
        className="flex w-full items-stretch bg-white rounded-md border border-[#E0E0E0] cursor-pointer overflow-x-auto"
      >
        <div className={`${cell} ${div} font-mono`}>{number}</div>
        <div className={`${cell} ${div}`}>0 Minutes</div>
        <div className={`${cell} ${div}`}>0 SMS</div>
        <div className={`${cell} ${div}`}>{dataBundle}</div>
        <div className={`${cell} ${div}`}>{delivered}</div>
        <div className={`${cell} ${div}`}>&nbsp;</div>
        <div className={`${cell} ${div}`}>{date}</div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Click row to download as image</p>
    </div>
  );
}