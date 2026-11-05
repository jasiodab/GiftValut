import { prisma } from "../lib/prisma";
import { productInclude, serializeProduct } from "../lib/serialize";
import { getBudgetSummary } from "./budget";

export async function getDashboardData(userId: string) {
  const [productsRaw, budget, settings, storeCount] = await Promise.all([
    prisma.product.findMany({
      where: { userId },
      include: productInclude,
      orderBy: { createdAt: "desc" }
    }),
    getBudgetSummary(userId),
    prisma.settings.findUnique({ where: { userId } }),
    prisma.store.count({ where: { userId } })
  ]);

  const products = productsRaw.map(serializeProduct);
  const totalValue = products.reduce((sum, product) => sum + (product.currentPrice ?? 0), 0);

  const favorites = products.filter((product) => product.status === "FAVORITE");
  const toBuy = products.filter((product) => product.status === "TO_BUY");
  const purchased = products.filter((product) => product.status === "PURCHASED");

  const priceDrops = products
    .filter((product) => product.isPriceDrop && product.priceChangePercent !== null)
    .sort((a, b) => (a.priceChangePercent ?? 0) - (b.priceChangePercent ?? 0))
    .slice(0, 4);

  const recentPriceUpdates = products
    .filter((product) => product.lastPriceCheckAt)
    .sort((a, b) => new Date(b.lastPriceCheckAt!).getTime() - new Date(a.lastPriceCheckAt!).getTime())
    .slice(0, 4);

  const categoryCounts = new Map<string, { name: string; color: string; count: number }>();
  for (const product of products) {
    if (!product.category) continue;
    const entry = categoryCounts.get(product.category.id) ?? {
      name: product.category.name,
      color: product.category.color,
      count: 0
    };
    entry.count += 1;
    categoryCounts.set(product.category.id, entry);
  }

  return {
    currency: settings?.currency ?? "PLN",
    stats: {
      totalProducts: products.length,
      favorites: favorites.length,
      toBuy: toBuy.length,
      purchased: purchased.length,
      totalValue: Math.round(totalValue * 100) / 100,
      stores: storeCount,
      autoTracked: products.filter((product) => product.autoTrack).length,
      withPrice: products.filter((product) => product.currentPrice !== null).length
    },
    recentlyAdded: products.slice(0, 4),
    favorites: favorites.slice(0, 4),
    priceDrops,
    recentPriceUpdates,
    categorySummary: [...categoryCounts.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
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
