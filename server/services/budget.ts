import { prisma } from "../lib/prisma";
import { serializeProduct } from "../lib/serialize";

async function loadProducts(userId: string) {
  return prisma.product.findMany({
    where: { userId },
    include: {
      category: true,
      store: true,
      group: true,
      tags: { include: { tag: true } }
    }
  });
}

function dedupeGroupedOffers<T extends { groupId: string | null; currentPrice: number | null }>(
  products: T[]
): T[] {
  const ungrouped: T[] = [];
  const grouped = new Map<string, T>();

  for (const product of products) {
    if (!product.groupId) {
      ungrouped.push(product);
      continue;
    }
    const current = grouped.get(product.groupId);
    const currentPrice = current?.currentPrice ?? Number.POSITIVE_INFINITY;
    const nextPrice = product.currentPrice ?? Number.POSITIVE_INFINITY;
    if (!current || nextPrice < currentPrice) {
      grouped.set(product.groupId, product);
    }
  }

  return [...ungrouped, ...grouped.values()];
}

function summarizeBudget(
  currency: string,
  budget: number | null,
  savedValue: number,
  plannedTotal: number,
  purchasedTotal: number
) {
  const committed = plannedTotal + purchasedTotal;
  const remaining = budget === null ? null : Math.round((budget - committed) * 100) / 100;
  const progress =
    budget !== null && budget > 0 ? Math.round(Math.min(100, (committed / budget) * 100) * 10) / 10 : 0;
  return {
    currency,
    budget,
    savedValue: Math.round(savedValue * 100) / 100,
    plannedTotal: Math.round(plannedTotal * 100) / 100,
    purchasedTotal: Math.round(purchasedTotal * 100) / 100,
    committed: Math.round(committed * 100) / 100,
    remaining,
    progress,
    overBudget: remaining !== null && remaining < 0
  };
}

// Lightweight variant for dashboards: avoids loading full product relations just
// to calculate totals.
export async function getBudgetOverview(userId: string) {
  const [settings, totals, statusProducts] = await Promise.all([
    prisma.settings.findUnique({
      where: { userId },
      select: { currency: true, budget: true }
    }),
    prisma.product.aggregate({ where: { userId }, _sum: { currentPrice: true } }),
    prisma.product.findMany({
      where: { userId, status: { in: ["TO_BUY", "PURCHASED"] } },
      select: { id: true, groupId: true, status: true, currentPrice: true }
    })
  ]);

  const planned = dedupeGroupedOffers(statusProducts.filter((product) => product.status === "TO_BUY"));
  const purchased = dedupeGroupedOffers(
    statusProducts.filter((product) => product.status === "PURCHASED")
  );
  const plannedTotal = planned.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0);
  const purchasedTotal = purchased.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0);

  return summarizeBudget(
    settings?.currency ?? "PLN",
    settings?.budget ?? null,
    totals._sum.currentPrice ?? 0,
    plannedTotal,
    purchasedTotal
  );
}

export async function getBudgetSummary(userId: string) {
  const [settings, products] = await Promise.all([
    prisma.settings.findUnique({ where: { userId } }),
    loadProducts(userId)
  ]);

  const budget = settings?.budget ?? null;
  const serializedAll = products.map(serializeProduct);
  const savedValue = serializedAll.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0);

  const plannedProducts = dedupeGroupedOffers(products.filter((product) => product.status === "TO_BUY"));
  const purchasedProducts = dedupeGroupedOffers(products.filter((product) => product.status === "PURCHASED"));

  const plannedItems = plannedProducts.map(serializeProduct);
  const purchasedItems = purchasedProducts.map(serializeProduct);
  const plannedTotal = plannedItems.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0);
  const purchasedTotal = purchasedItems.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0);
  const summary = summarizeBudget(
    settings?.currency ?? "PLN",
    budget,
    savedValue,
    plannedTotal,
    purchasedTotal
  );

  const categoryMap = new Map<string, { id: string; name: string; color: string; planned: number; purchased: number }>();
  for (const product of [...plannedItems, ...purchasedItems]) {
    if (!product.category) continue;
    const entry = categoryMap.get(product.category.id) ?? {
      id: product.category.id,
      name: product.category.name,
      color: product.category.color,
      planned: 0,
      purchased: 0
    };
    if (product.status === "TO_BUY") entry.planned += product.currentPrice ?? 0;
    if (product.status === "PURCHASED") entry.purchased += product.currentPrice ?? 0;
    categoryMap.set(product.category.id, entry);
  }

  return {
    ...summary,
    plannedItems,
    purchasedItems,
    unpricedPlanned: plannedItems.filter((product) => product.currentPrice === null).length,
    unpricedPurchased: purchasedItems.filter((product) => product.currentPrice === null).length,
    categoryBreakdown: [...categoryMap.values()]
      .map((entry) => ({
        ...entry,
        planned: Math.round(entry.planned * 100) / 100,
        purchased: Math.round(entry.purchased * 100) / 100,
        total: Math.round((entry.planned + entry.purchased) * 100) / 100
      }))
      .sort((a, b) => b.total - a.total)
  };
}
