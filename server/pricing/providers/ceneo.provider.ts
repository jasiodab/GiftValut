import { pricingConfig } from "../config";
import type { PriceProvider, NormalizedOffer } from "./types";

export const ceneoProvider: PriceProvider = {
  name: "CENEO",
  isConfigured: () => Boolean(pricingConfig.ceneoApiKey),
  configurationMessage: () => "Set CENEO_API_KEY to enable Ceneo.",
  async search(_query, product, options) {
    if (!this.isConfigured()) return [];
    const q = product.ean || product.name;
    const base = pricingConfig.ceneoApiUrl.replace(/\/$/, "");
    const url = `${base}/Search?apiKey=${encodeURIComponent(pricingConfig.ceneoApiKey)}&phrase=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: options?.signal });
    if (!res.ok) throw new Error(`Ceneo search failed: ${res.status}`);
    const json = (await res.json()) as any;
    const items = Array.isArray(json) ? json : json?.products ?? json?.offers ?? [];
    const now = new Date().toISOString();
    return items.map((it: any, idx: number) => {
      const price = it?.price != null ? Math.round(Number(it.price) * 100) : (it?.priceCents ?? null);
      return {
        provider: "CENEO" as const,
        externalId: String(it?.id ?? it?.productId ?? idx),
        title: String(it?.name ?? it?.title ?? ""),
        url: String(it?.url ?? it?.offerUrl ?? ""),
        sellerName: it?.shopName ?? it?.store ?? null,
        imageUrl: it?.imageUrl ?? it?.image ?? null,
        brand: it?.brand ?? null,
        model: it?.model ?? null,
        ean: it?.ean ?? product.ean ?? null,
        itemPriceCents: price,
        shippingPriceCents: it?.shippingPriceCents ?? null,
        totalPriceCents: price,
        currency: it?.currency ?? "PLN",
        condition: it?.condition ?? "new",
        availability: it?.availability ?? null,
        fetchedAt: now
      };
    });
  }
};
