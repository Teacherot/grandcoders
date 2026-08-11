import { supabase } from "@/lib/supabaseClient";
import { getOrdersFromSupabase } from "@/lib/supabaseData";

const entityTableMap = {
  Agent: "agents",
  Package: "packages",
  Report: "reports",
  Notification: "notifications",
  Order: "orders",
};

async function getRowsForEntity(entityName) {
  if (entityName === "Order") {
    return getOrdersFromSupabase();
  }

  const table = entityTableMap[entityName];
  if (!supabase || !table) {
    return [];
  }

  try {
    const { data, error } = await supabase.from(table).select("code").order("created_date", { ascending: false }).limit(5000);
    if (error) {
      console.warn("Code lookup failed:", error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.warn("Code lookup failed:", error);
    return [];
  }
}

export async function nextCode(entityName, prefix) {
  const all = await getRowsForEntity(entityName);

  let max = 0;
  all.forEach((r) => {
    const m = typeof r.code === "string" ? r.code.match(/(\d+)\s*$/) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function nextCodes(entityName, prefix, count) {
  const all = await getRowsForEntity(entityName);

  let max = 0;
  all.forEach((r) => {
    const m = typeof r.code === "string" ? r.code.match(/(\d+)\s*$/) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  const out = [];
  for (let i = 1; i <= count; i++) out.push(`${prefix}${String(max + i).padStart(3, "0")}`);
  return out;
}