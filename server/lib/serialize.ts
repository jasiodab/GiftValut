export function serializeProduct(product: any) {
  const histories: Array<{ price: number; recordedAt: Date | string }> = product.priceHistory ?? [];
  const currentPrice: number | null = product.currentPrice ?? null;
  const previousPrice =
    currentPrice === null
      ? null
      : (histories.find((entry) => Number(entry.price) !== Number(currentPrice))?.price ?? null);
  const priceChange =
    currentPrice !== null && previousPrice !== null
      ? Math.round((currentPrice - previousPrice) * 100) / 100
      : null;
  const priceChangePercent =
    currentPrice !== null && previousPrice !== null && previousPrice !== 0
      ? Math.round(((currentPrice - previousPrice) / previousPrice) * 10000) / 100
      : null;

  return {
    id: product.id,
    name: product.name,
    url: product.url,
    normalizedUrl: product.normalizedUrl,
    description: product.description,
    imageUrl: product.imagePath ?? null,
    imageSourceUrl: product.imageSourceUrl ?? null,
    currentPrice,
    originalPrice: product.originalPrice ?? null,
    currency: product.currency,
    availability: product.availability ?? null,
    status: product.status,
    notes: product.notes ?? null,
    autoTrack: product.autoTrack,
    store: product.store
      ? { id: product.store.id, name: product.store.name, domain: product.store.domain }
      : null,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
          color: product.category.color,
          icon: product.category.icon
        }
      : null,
    group: product.group ? { id: product.group.id, name: product.group.name } : null,
    tags: (product.tags ?? []).map((productTag: any) => productTag.tag?.name ?? productTag.name).filter(Boolean),
    lastCheckedAt: product.lastCheckedAt,
    lastCheckStatus: product.lastCheckStatus,
    lastCheckError: product.lastCheckError,
    lastPriceCheckAt: product.lastPriceCheckAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    previousPrice: previousPrice !== null ? Math.round(previousPrice * 100) / 100 : null,
    priceChange,
    priceChangePercent,
    isPriceDrop: priceChange !== null && priceChange < 0,
    discountPercent:
      currentPrice !== null && product.originalPrice && product.originalPrice > currentPrice
        ? Math.round(((product.originalPrice - currentPrice) / product.originalPrice) * 100)
        : null
  };
}

export type SerializedProduct = ReturnType<typeof serializeProduct>;

export const productInclude = {
  store: true,
  category: true,
  group: true,
  tags: { include: { tag: true } },
  priceHistory: { orderBy: { recordedAt: "desc" as const }, take: 3, select: { price: true, recordedAt: true } }
};
