import { pricingConfig } from "../config";
import type { PriceProvider, NormalizedOffer } from "./types";

export const googleShoppingProvider: PriceProvider = {
  name: "GOOGLE_SHOPPING",
  isConfigured: () => Boolean(pricingConfig.searchApiApiKey),
  configurationMessage: () => "Set SEARCHAPI_API_KEY to enable Google Shopping results.",
  async search(_query, product, options) {
    if (!this.isConfigured()) return [];
    const q = product.ean || product.name;
    const url = `https://www.searchapi.io/api/v1/search?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(pricingConfig.searchApiApiKey)}`;
    const res = await fetch(url, { signal: options?.signal });
    if (!res.ok) throw new Error(`Google Shopping search failed: ${res.status}`);
    const json = (await res.json()) as any;
    const items = json?.shopping_results ?? json?.results ?? [];
    const now = new Date().toISOString();
    return items.map((it: any, idx: number) => {
      const price = it?.extracted_price != null ? Math.round(Number(it.extracted_price) * 100) : (it?.price ? Math.round(Number(String(it.price).replace(/[^0-9.]/g, "")) * 100) : null);
      return {
        provider: "GOOGLE_SHOPPING" as const,
        externalId: String(it?.product_id ?? it?.id ?? idx),
        title: String(it?.title ?? ""),
        url: String(it?.link ?? it?.product_link ?? ""),
        sellerName: it?.source ?? it?.merchant ?? null,
        imageUrl: it?.thumbnail ?? it?.image ?? null,
        brand: null,
        model: null,
        ean: product.ean ?? null,
        itemPriceCents: price,
        shippingPriceCents: null,
        totalPriceCents: price,
        currency: it?.currency ?? "PLN",
        condition: null,
        availability: null,
        fetchedAt: now
      };
    });
  }
};
