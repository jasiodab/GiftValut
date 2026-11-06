import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { providers } from "./providers";
import { priceCache } from "./cache";
import { scoreOffer, classifyScore } from "./matcher";
import { pricingConfig } from "./config";
import type { NormalizedOffer } from "./providers/types";

export type SearchOutcome = {
  checkId: string;
  offers: any[];
  providerRuns: any[];
  cached: boolean;
};

export async function searchProductPrices(userId: string, productId: string, force = false): Promise<SearchOutcome> {
  const product = await prisma.product.findFirst({ where: { id: productId, userId } });
  if (!product) throw new AppError(404, "Product not found.", "PRODUCT_NOT_FOUND");

  const cacheKey = `price:${userId}:${productId}`;
  if (!force) {
    const cached = priceCache.get<SearchOutcome>(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  const check = await prisma.priceCheck.create({
    data: { userId, productId, status: "RUNNING" }
  });

  const query = product.name;
  // product has no brand/model columns; derive from name loosely
  const productInput = { name: product.name, brand: null, model: null, ean: null, condition: "new" };

  const runs: any[] = [];
  const allOffers: { offer: NormalizedOffer; score: number; status: string }[] = [];

  const tasks = providers.map(async (provider) => {
    const run = await prisma.priceProviderRun.create({
      data: { checkId: check.id, provider: provider.name, status: "RUNNING" }
    });
    if (!provider.isConfigured()) {
      await prisma.priceProviderRun.update({
        where: { id: run.id },
        data: { status: "SKIPPED", errorMessage: provider.configurationMessage(), finishedAt: new Date(), resultsCount: 0 }
      });
      runs.push({ ...run, status: "SKIPPED", errorMessage: provider.configurationMessage() });
      return;
    }
    let controller: AbortController | null = null;
    try {
      controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), pricingConfig.searchTimeoutMs);
      try {
        const offers = await provider.search(query, productInput, { signal: controller.signal });
        for (const o of offers) {
          const score = scoreOffer(productInput, o);
          const status = classifyScore(score);
          if (status === "REJECT") continue;
          allOffers.push({ offer: o, score, status });
        }
        await prisma.priceProviderRun.update({
          where: { id: run.id },
          data: { status: "SUCCESS", resultsCount: offers.length, finishedAt: new Date() }
        });
        runs.push({ ...run, status: "SUCCESS", resultsCount: offers.length });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      const msg = controller?.signal.aborted
        ? "Provider request timed out."
        : err instanceof Error
          ? err.message
          : "Unknown error";
      await prisma.priceProviderRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorMessage: msg, finishedAt: new Date(), resultsCount: 0 }
      });
      runs.push({ ...run, status: "FAILED", errorMessage: msg });
    }
  });

  await Promise.allSettled(tasks);

  // Persist offers + snapshots
  const persistedOffers: any[] = [];
  for (const { offer, score, status } of allOffers) {
    const matchStatus = status === "HIGH" || status === "MEDIUM" ? "CONFIRMED" : "PENDING";
    const upserted = await prisma.priceOffer.upsert({
      where: { userId_provider_externalId: { userId, provider: offer.provider, externalId: offer.externalId } },
      create: {
        userId,
        productId,
        provider: offer.provider,
        externalId: offer.externalId,
        title: offer.title,
        url: offer.url,
        sellerName: offer.sellerName,
        imageUrl: offer.imageUrl,
        brand: offer.brand,
        model: offer.model,
        ean: offer.ean,
        condition: offer.condition,
        latestTotalPriceCents: offer.totalPriceCents,
        currency: offer.currency,
        lastSeenAt: new Date(offer.fetchedAt),
        matchScore: score,
        matchStatus
      },
      update: {
        title: offer.title,
        url: offer.url,
        sellerName: offer.sellerName,
        imageUrl: offer.imageUrl,
        brand: offer.brand,
        model: offer.model,
        ean: offer.ean,
        condition: offer.condition,
        latestTotalPriceCents: offer.totalPriceCents,
        currency: offer.currency,
        lastSeenAt: new Date(offer.fetchedAt),
        matchScore: score
      }
    });
    await prisma.priceSnapshot.create({
      data: {
        offerId: upserted.id,
        checkId: check.id,
        itemPriceCents: offer.itemPriceCents,
        shippingPriceCents: offer.shippingPriceCents,
        totalPriceCents: offer.totalPriceCents,
        currency: offer.currency,
        availability: offer.availability,
        observedAt: new Date(offer.fetchedAt)
      }
    });
    persistedOffers.push({ ...upserted, score, status, offer });
  }

  await prisma.priceCheck.update({
    where: { id: check.id },
    data: { status: "COMPLETED", finishedAt: new Date() }
  });

  const outcome: SearchOutcome = {
    checkId: check.id,
    offers: persistedOffers.map((p) => ({
      id: p.id,
      provider: p.provider,
      externalId: p.externalId,
      title: p.title,
      url: p.url,
      sellerName: p.sellerName,
      imageUrl: p.imageUrl,
      brand: p.brand,
      model: p.model,
      ean: p.ean,
      condition: p.condition,
      latestTotalPriceCents: p.latestTotalPriceCents,
      currency: p.currency,
      lastSeenAt: p.lastSeenAt,
      matchScore: p.matchScore,
      matchStatus: p.matchStatus,
      score: p.score,
      status: p.status
    })),
    providerRuns: runs,
    cached: false
  };

  priceCache.set(cacheKey, outcome);
  return outcome;
}
