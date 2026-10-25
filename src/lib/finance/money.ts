export function validPurchasePrice(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 99_999_999_900 &&
    Math.abs(value * 100 - cents) < 0.000001;
}

export const formatMXN = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value) + " MXN";
