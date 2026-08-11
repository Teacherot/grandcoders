import React from "react";

const styles = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-neutral-200 text-neutral-500 border-neutral-300",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  open: "bg-rose-50 text-rose-700 border-rose-200",
  reviewing: "bg-blue-50 text-blue-700 border-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-neutral-200 text-neutral-500 border-neutral-300",
  suspended: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] || styles.suspended}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}