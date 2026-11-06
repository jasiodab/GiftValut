import { pricingConfig } from "../config";
import type { PriceProvider, NormalizedOffer } from "./types";

export const amazonProvider: PriceProvider = {
  name: "AMAZON",
  isConfigured: () => Boolean(pricingConfig.amazonAccessKey && pricingConfig.amazonSecretKey && pricingConfig.amazonPartnerTag),
  configurationMessage: () => "Amazon Creators API access (AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG) is required and must be approved by Amazon.",
  async search(_query, product, options) {
    if (!this.isConfigured()) return [];
    // Amazon Creators API requires signed requests; availability depends on account approval.
    // We perform a guarded call and surface failures to the orchestrator.
    const q = product.ean || product.name;
    const url = `https://webservices.amazon.com/paapi5/searchitems`;
    const body = {
      Keywords: q,
      SearchIndex: "All",
      ItemPage: 1,
      Resources: ["Images.Primary.Large", "Offers.Listings.Price", "ItemInfo.Title"]
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems",
        "AssociateTag": pricingConfig.amazonPartnerTag
      },
      body: JSON.stringify(body),
      signal: options?.signal
    });
    if (!res.ok) throw new Error(`Amazon search failed: ${res.status}`);
    const json = (await res.json()) as any;
    const items = json?.SearchResult?.Items ?? [];
    const now = new Date().toISOString();
    return items.map((it: any) => {
      const price = it?.Offers?.Listings?.[0]?.Price?.Amount ? Math.round(Number(it.Offers.Listings[0].Price.Amount) * 100) : null;
      return {
        provider: "AMAZON" as const,
        externalId: String(it.ASIN),
        title: String(it?.ItemInfo?.Title?.DisplayValue ?? ""),
        url: String(it?.DetailPageURL ?? `https://www.amazon.com/dp/${it.ASIN}`),
        sellerName: "Amazon",
        imageUrl: it?.Images?.Primary?.Large?.URL ?? null,
        brand: it?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ?? null,
        model: null,
        ean: product.ean ?? null,
        itemPriceCents: price,
        shippingPriceCents: null,
        totalPriceCents: price,
        currency: it?.Offers?.Listings?.[0]?.Price?.Currency ?? "USD",
        condition: "new",
        availability: it?.Offers?.Listings?.[0]?.Availability?.Message ?? null,
        fetchedAt: now
      };
    });
  }
};
