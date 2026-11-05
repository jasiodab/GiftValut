import { z } from "zod";

export const pricingConfig = {
  ceneoApiKey: process.env.CENEO_API_KEY ?? "",
  ceneoApiUrl: process.env.CENEO_API_URL ?? "https://api.ceneo.pl",
  allegroClientId: process.env.ALLEGRO_CLIENT_ID ?? "",
  allegroClientSecret: process.env.ALLEGRO_CLIENT_SECRET ?? "",
  amazonAccessKey: process.env.AMAZON_ACCESS_KEY ?? "",
  amazonSecretKey: process.env.AMAZON_SECRET_KEY ?? "",
  amazonPartnerTag: process.env.AMAZON_PARTNER_TAG ?? "",
  searchApiApiKey: process.env.SEARCHAPI_API_KEY ?? "",
  cacheTtlSeconds: Number(process.env.PRICE_CACHE_TTL ?? "1800"),
  searchTimeoutMs: Number(process.env.PRICE_SEARCH_TIMEOUT ?? "15000")
};

export function validatePricingConfig() {
  // Non-fatal: log which providers are configured.
  const configured: string[] = [];
  if (pricingConfig.ceneoApiKey) configured.push("CENEO");
  if (pricingConfig.allegroClientId && pricingConfig.allegroClientSecret) configured.push("ALLEGRO");
  if (pricingConfig.amazonAccessKey && pricingConfig.amazonSecretKey && pricingConfig.amazonPartnerTag) configured.push("AMAZON");
  if (pricingConfig.searchApiApiKey) configured.push("GOOGLE_SHOPPING");
  // eslint-disable-next-line no-console
  console.log(`Price providers configured: ${configured.length ? configured.join(", ") : "none"}`);
}
