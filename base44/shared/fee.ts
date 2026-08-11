// Shared KoraPay fee passthrough helper. The customer pays the agent's sell
// price + a fixed fee so the platform no longer absorbs KoraPay's transaction
// cost. The agent is only ever credited commission_rate% of the SELL price —
// the fee portion is never credited to the agent.
//
// Fee rate is fixed at 2.92% (the observed KoraPay charge on a GHS 13 payment,
// which settled GHS 12.62). Total is rounded to 2 decimals (major units, GHS).

export const KORAPAY_FEE_RATE = 0.0292;

export function feeInclusiveTotal(sellPrice) {
  const sell = Number(sellPrice || 0);
  const total = sell * (1 + KORAPAY_FEE_RATE);
  return Math.round(total * 100) / 100;
}

export function feeAmount(sellPrice) {
  const sell = Number(sellPrice || 0);
  return Math.max(0, feeInclusiveTotal(sell) - sell);
}