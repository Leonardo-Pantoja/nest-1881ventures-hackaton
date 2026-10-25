import { validPurchasePrice } from "./money";

type Selection = { name: string; price: number | null };

/** Keep each product and its price together; an explicitly cleared price must not revive an older URL/session price. */
export function resolveEvaluationSelection(confirmed: Selection | null, queryName: string | null, queryPrice: string | null, pending: Selection): Selection {
  const candidate = confirmed ?? (queryName !== null || queryPrice !== null
    ? { name: queryName ?? "", price: queryPrice?.trim() ? Number(queryPrice) : null }
    : pending);
  return { name: candidate.name.trim() || "Producto consultado", price: validPurchasePrice(candidate.price) ? candidate.price : null };
}
