import { prisma } from "../lib/prisma";
import { productInclude, serializeProduct } from "../lib/serialize";
import { getBudgetOverview } from "./budget";

export async function getDashboardData(userId: string) {
  const [statusGroups, totals, autoTracked, withPrice, storeCount, recentlyAddedRaw, favoritesRaw, recentUpdatesRaw, priceDropCandidates, budget, topCategories] =
    await Promise.all([
      prisma.product.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true }
      }),
      prisma.product.aggregate({ where: { userId }, _sum: { currentPrice: true } }),
      prisma.product.count({ where: { userId, autoTrack: true } }),
      prisma.product.count({ where: { userId, currentPrice: { not: null } } }),
      prisma.store.count({ where: { userId } }),
      prisma.product.findMany({
        where: { userId },
        include: productInclude,
        orderBy: { createdAt: "desc" },
        take: 4
      }),
      prisma.product.findMany({
        where: { userId, status: "FAVORITE" },
        include: productInclude,
        orderBy: { createdAt: "desc" },
        take: 4
      }),
      prisma.product.findMany({
        where: { userId, lastPriceCheckAt: { not: null } },
        include: productInclude,
        orderBy: { lastPriceCheckAt: "desc" },
        take: 4
      }),
      // Only identifiers and recent prices are needed to find the biggest drops.
      prisma.product.findMany({
        where: { userId, currentPrice: { not: null } },
        select: {
          id: true,
          currentPrice: true,
          priceHistory: {
            orderBy: { recordedAt: "desc" },
            take: 3,
            select: { price: true }
          }
        }
      }),
      getBudgetOverview(userId),
      prisma.category.findMany({
        where: { userId },
        select: { id: true, name: true, color: true, _count: { select: { products: true } } },
        orderBy: { products: { _count: "desc" } },
        take: 5
      })
    ]);

  const statusCounts = new Map(statusGroups.map((entry) => [entry.status, entry._count._all]));
  const totalProducts = statusGroups.reduce((sum, entry) => sum + entry._count._all, 0);

  const dropCandidates = priceDropCandidates
    .map((product) => {
      const previous = product.priceHistory.find(
        (entry) => Number(entry.price) !== Number(product.currentPrice)
      );
      if (!previous || previous.price === 0) return null;
      const current = product.currentPrice as number;
      const changePercent = Math.round(((current - previous.price) / previous.price) * 10000) / 100;
      if (changePercent >= 0) return null;
      return { id: product.id, changePercent };
    })
    .filter((entry): entry is { id: string; changePercent: number } => entry !== null)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 4);

  const dropIds = dropCandidates.map((entry) => entry.id);
  const dropProductsRaw = dropIds.length
    ? await prisma.product.findMany({
        where: { id: { in: dropIds }, userId },
        include: productInclude
      })
    : [];
  const dropProducts = new Map(dropProductsRaw.map((product) => [product.id, serializeProduct(product)]));
  const priceDrops = dropIds
    .map((id) => dropProducts.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return {
    currency: budget.currency,
    stats: {
      totalProducts,
      favorites: statusCounts.get("FAVORITE") ?? 0,
      toBuy: statusCounts.get("TO_BUY") ?? 0,
      purchased: statusCounts.get("PURCHASED") ?? 0,
      totalValue: Math.round((totals._sum.currentPrice ?? 0) * 100) / 100,
      stores: storeCount,
      autoTracked,
      withPrice
    },
    recentlyAdded: recentlyAddedRaw.map(serializeProduct),
    favorites: favoritesRaw.map(serializeProduct),
    priceDrops,
    recentPriceUpdates: recentUpdatesRaw.map(serializeProduct),
    categorySummary: topCategories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      count: category._count.products
    })),
    budget: {
      budget: budget.budget,
      plannedTotal: budget.plannedTotal,
      purchasedTotal: budget.purchasedTotal,
      savedValue: budget.savedValue,
      remaining: budget.remaining,
      progress: budget.progress,
      overBudget: budget.overBudget
    }
  };
}
