import { prisma } from "../lib/prisma";
import { productInclude, serializeProduct } from "../lib/serialize";
import { getBudgetOverview } from "./budget";

export async function getDashboardData(userId: string) {
  const [statusGroups, totals, withPrice, storeCount, recentlyAddedRaw, favoritesRaw, budget, topCategories] =
    await Promise.all([
      prisma.product.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true }
      }),
      prisma.product.aggregate({ where: { userId }, _sum: { currentPrice: true } }),
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

  return {
    currency: budget.currency,
    stats: {
      totalProducts,
      favorites: statusCounts.get("FAVORITE") ?? 0,
      toBuy: statusCounts.get("TO_BUY") ?? 0,
      purchased: statusCounts.get("PURCHASED") ?? 0,
      totalValue: Math.round((totals._sum.currentPrice ?? 0) * 100) / 100,
      stores: storeCount,
      withPrice
    },
    recentlyAdded: recentlyAddedRaw.map(serializeProduct),
    favorites: favoritesRaw.map(serializeProduct),
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
