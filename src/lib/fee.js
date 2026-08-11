// Client-side mirror of base44/shared/fee.ts for storefront price display.
// The server (initializeKorapayCharge) is the source of truth for the actual
// charge; this only drives what the customer sees on the bundle card.

export const KORAPAY_FEE_RATE = 0.0292;

export function feeInclusiveTotal(sellPrice) {
  const sell = Number(sellPrice || 0);
  const total = sell * (1 + KORAPAY_FEE_RATE);
  return Math.round(total * 100) / 100;
}