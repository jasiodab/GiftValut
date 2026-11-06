export type ProviderName = "CENEO" | "ALLEGRO" | "AMAZON" | "GOOGLE_SHOPPING";

export type NormalizedOffer = {
  provider: ProviderName;
  externalId: string;
  title: string;
  url: string;
  sellerName: string | null;
  imageUrl: string | null;
  brand: string | null;
  model: string | null;
  ean: string | null;
  itemPriceCents: number | null;
  shippingPriceCents: number | null;
  totalPriceCents: number | null;
  currency: string;
  condition: string | null;
  availability: string | null;
  fetchedAt: string;
};

export type PriceSearchOptions = {
  signal?: AbortSignal;
};

export type PriceProvider = {
  name: ProviderName;
  isConfigured: () => boolean;
  search: (
    query: string,
    product: { name: string; brand?: string | null; model?: string | null; ean?: string | null },
    options?: PriceSearchOptions
  ) => Promise<NormalizedOffer[]>;
  configurationMessage: () => string;
};

export type ProviderStatus = {
  provider: ProviderName;
  configured: boolean;
  message: string;
};
