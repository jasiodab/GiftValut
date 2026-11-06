export function serializeProduct(product: any) {
  const currentPrice: number | null = product.currentPrice ?? null;

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
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
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
  tags: { include: { tag: true } }
};
