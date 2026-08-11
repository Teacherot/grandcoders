// Net revenue = agent price (what the agent pays the platform, Package.agent_price)
// minus the GMPL cost (what the supplier charges the platform, from the GMPL API's
// agentAmount). Both are resolved by network + volume_gb and combined per order.

export function buildBaseCostLookup(packages = []) {
  const byName = new Map();
  const byKey = new Map();
  for (const p of packages) {
    const cost = Number(p.agent_price || 0);
    if (p.name) byName.set(p.name.toLowerCase(), cost);
    byKey.set(`${(p.network || "").toLowerCase()}|${Number(p.volume_gb || 0)}`, cost);
  }
  return (order) => {
    if (!order) return 0;
    if (order.package_name) {
      const c = byName.get(order.package_name.toLowerCase());
      if (c != null) return c;
    }
    const k = `${(order.network || "").toLowerCase()}|${Number(order.volume_gb || 0)}`;
    return byKey.get(k) || 0;
  };
}

// Supplier cost is a flat GH₵ 3.5 per GB across all networks. The live GMPL
// pricing feed is unreliable (it dropped MTN bundles), so net profit is
// computed against this fixed rate rather than the live agentAmount.
const SUPPLIER_COST_PER_GB = 3.5;

export function buildGmplCostLookup(_gmplPricing = []) {
  return (order) => Number(order?.volume_gb || 0) * SUPPLIER_COST_PER_GB;
}

// Net margin per order = agent price − GMPL cost.
export function buildNetMarginLookup(packages = [], gmplPricing = []) {
  const agentPrice = buildBaseCostLookup(packages);
  const gmplCost = buildGmplCostLookup(gmplPricing);
  return (order) => agentPrice(order) - gmplCost(order);
}

// A supplier-refunded order is one the supplier marked failed and credited back.
// The webhook tags its reference with "supplier-refund".
export function isSupplierRefund(order) {
  return !!order && order.status === "failed" && String(order.reference || "").toLowerCase().includes("supplier-refund");
}

// Net contribution of a refunded order = reversal of the margin that would have
// been earned, so refunds lower the net revenue figure.
export function refundNet(order, netMargin) {
  return -netMargin(order);
}