import { validPurchasePrice } from "../finance/money";
import type { FinancialIntent, ProductContext } from "./schemas";

const normalize = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ").replace(/\b(?:el|la|los|las|un|una|unos|unas|mi|mis|este|esta|estos|estas)\b/g, " ").replace(/\s+/g, " ").trim();

/** Placeholder labels and pronouns do not identify a product. */
export function identifiedProductName(name: string | null | undefined): string | null {
  const value = name?.trim();
  if (!value) return null;
  return /^(?:producto(?: consultado| por evaluar| confirmado)?|compra(?: consultada| por evaluar)?|este producto|ese producto|eso|algo|uno|una|lo|otro|otra|alternativa)$/i.test(value)
    ? null : value;
}

/** Read only an explicit purchase mention; references such as "uno" keep the existing context. */
export function requestedProductName(message: string): string | null {
  const ending = /(?=\s+(?:de|por|a)\s*\$|\s*\$|[?!.]|$)/;
  const explicit = new RegExp(`(?:comprar(?:me)?|compro|evaluar)\\s+(.+?)${ending.source}`, "i");
  const wish = new RegExp(`\\bquiero\\s+(.+?)${ending.source}`, "i");
  const mention = (message.match(explicit)?.[1] ?? message.match(wish)?.[1])?.trim();
  if (!mention || /^(?:uno|una|otro|otra|lo|algo|este|ese|esto|eso)(?:\s+(?:de|por|m[aá]s|igual|similar|barat[oa]|econ[oó]mic[oa]))?$/i.test(mention)) return null;
  return identifiedProductName(mention.replace(/^(?:un|una|unos|unas|el|la|los|las|otro|otra)\s+/i, "").replace(/\s+(?:de|por|a)$/, "").trim());
}

export function sameProductName(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = identifiedProductName(left), b = identifiedProductName(right);
  if (!a || !b) return false;
  const x = normalize(a), y = normalize(b);
  return Boolean(x && y && (x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `)));
}

/** Scenario prices can only carry over when they still refer to the same product. */
export function resolveIntentProduct(intent: FinancialIntent, context: ProductContext | null): ProductContext | null {
  const name = identifiedProductName(intent.productName);
  const matchingContext = context && (!name || sameProductName(name, context.name)) ? context : null;
  if (intent.price !== null) {
    if (!validPurchasePrice(intent.price)) throw Error("invalid_purchase_price");
    return { name: name ?? matchingContext?.name ?? "Compra sin producto identificado", price: intent.price };
  }
  return matchingContext;
}

/** Only monetary expressions are prices; model numbers and weekly periods are not. */
export function explicitMonetaryAmounts(message: string): number[] {
  const values: number[] = [];
  const pattern = /\$\s*(-?\d[\d,]*(?:\.\d+)?)|(-?\d[\d,]*(?:\.\d+)?)\s*(?:pesos|MXN)\b|\b(?:cuesta|precio(?:\s+es|\s+de)?)\s*:?\s*(-?\d[\d,]*(?:\.\d+)?)/gi;
  for (const match of message.matchAll(pattern)) values.push(Number((match[1] ?? match[2] ?? match[3]).replace(/,/g, "")));
  return values;
}
