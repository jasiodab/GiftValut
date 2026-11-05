import type { NormalizedOffer } from "./providers/types";

export type MatchInput = {
  name: string;
  brand?: string | null;
  model?: string | null;
  ean?: string | null;
  condition?: string | null;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, " ").trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

function extractVariantSpecs(s: string): { capacity?: string; color?: string; size?: string; generation?: string } {
  const lower = s.toLowerCase();
  const cap = lower.match(/(\d+)\s*(gb|tb|ml|l|kg|g)\b/);
  const gen = lower.match(/gen(?:eration)?\s*(\d+)/);
  return {
    capacity: cap ? cap[0] : undefined,
    generation: gen ? gen[0] : undefined
  };
}

export function scoreOffer(product: MatchInput, offer: NormalizedOffer): number {
  let score = 0;
  // EAN exact
  if (product.ean && offer.ean && product.ean === offer.ean) return 100;
  // Brand/model
  const pBrand = (product.brand ?? "").toLowerCase();
  const oTitle = offer.title.toLowerCase();
  if (pBrand && oTitle.includes(pBrand)) score += 25;
  if (product.model && oTitle.includes(product.model.toLowerCase())) score += 25;
  // Name token overlap
  const pTokens = tokens(product.name);
  const oTokens = tokens(offer.title);
  const overlap = pTokens.filter((t) => oTokens.includes(t)).length;
  const denom = Math.max(pTokens.length, 1);
  score += Math.round((overlap / denom) * 40);
  // Variant specs must match
  const pSpecs = extractVariantSpecs(product.name);
  const oSpecs = extractVariantSpecs(offer.title);
  if (pSpecs.capacity && oSpecs.capacity && pSpecs.capacity !== oSpecs.capacity) score -= 30;
  if (pSpecs.generation && oSpecs.generation && pSpecs.generation !== oSpecs.generation) score -= 30;
  // Condition: reject used if seeking new
  const wantNew = (product.condition ?? "new").toLowerCase() === "new";
  const offerCond = (offer.condition ?? "").toLowerCase();
  if (wantNew && (offerCond.includes("used") || offerCond.includes("używ") || offerCond.includes("refurb"))) score -= 40;
  return Math.max(0, Math.min(100, score));
}

export function classifyScore(score: number): "HIGH" | "MEDIUM" | "REVIEW" | "REJECT" {
  if (score >= 95) return "HIGH";
  if (score >= 85) return "MEDIUM";
  if (score >= 70) return "REVIEW";
  return "REJECT";
}
