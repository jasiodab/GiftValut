import { pricingConfig } from "../config";
import type { PriceProvider, NormalizedOffer } from "./types";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const basic = Buffer.from(`${pricingConfig.allegroClientId}:${pricingConfig.allegroClientSecret}`).toString("base64");
  const res = await fetch("https://allegro.pl/auth/oauth/token?grant_type=client_credentials", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` }
  });
  if (!res.ok) throw new Error(`Allegro auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

export const allegroProvider: PriceProvider = {
  name: "ALLEGRO",
  isConfigured: () => Boolean(pricingConfig.allegroClientId && pricingConfig.allegroClientSecret),
  configurationMessage: () => "Set ALLEGRO_CLIENT_ID and ALLEGRO_CLIENT_SECRET to enable Allegro.",
  async search(_query, product) {
    if (!this.isConfigured()) return [];
    const token = await getToken();
    const q = product.ean || product.name;
    const url = `https://api.allegro.pl/offers/listing?phrase=${encodeURIComponent(q)}&limit=20&sort=price_asc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.allegro.public.v1+json" }
    });
    if (!res.ok) throw new Error(`Allegro search failed: ${res.status}`);
    const json = (await res.json()) as any;
    const items = json?.items?.promoted ?? json?.items?.regular ?? [];
    const now = new Date().toISOString();
    return items.map((it: any) => {
      const price = it?.sellingMode?.price?.amount ? Math.round(Number(it.sellingMode.price.amount) * 100) : null;
      return {
        provider: "ALLEGRO" as const,
        externalId: String(it.id),
        title: String(it.name ?? ""),
        url: String(it.url ?? `https://allegro.pl/oferta/${it.id}`),
        sellerName: it?.seller?.login ?? null,
        imageUrl: it?.images?.[0]?.url ?? null,
        brand: null,
        model: null,
        ean: product.ean ?? null,
        itemPriceCents: price,
        shippingPriceCents: null,
        totalPriceCents: price,
        currency: it?.sellingMode?.price?.currency ?? "PLN",
        condition: it?.condition ?? null,
        availability: it?.stock?.available ? "In stock" : null,
        fetchedAt: now
      };
    });
  }
};
