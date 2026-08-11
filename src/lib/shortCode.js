import { base44 } from "@/api/base44Client";

export async function nextCode(entityName, prefix) {
  const all = await base44.entities[entityName].list("-created_date", 5000);
  let max = 0;
  all.forEach((r) => {
    const m = typeof r.code === "string" ? r.code.match(/(\d+)\s*$/) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function nextCodes(entityName, prefix, count) {
  const all = await base44.entities[entityName].list("-created_date", 5000);
  let max = 0;
  all.forEach((r) => {
    const m = typeof r.code === "string" ? r.code.match(/(\d+)\s*$/) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  const out = [];
  for (let i = 1; i <= count; i++) out.push(`${prefix}${String(max + i).padStart(3, "0")}`);
  return out;
}