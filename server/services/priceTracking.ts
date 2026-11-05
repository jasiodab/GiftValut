import { prisma } from "../lib/prisma";
import { extractProduct } from "./extraction";
import { AppError } from "../lib/errors";
import { productInclude, serializeProduct } from "../lib/serialize";
import { roundMoney } from "../lib/money";
import { isMaintenanceMode } from "../lib/maintenance";

let schedulerHandle: NodeJS.Timeout | null = null;
let schedulerBusy = false;

export async function refreshProductPrice(userId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, userId } });
  if (!product) throw new AppError(404, "Product not found.", "PRODUCT_NOT_FOUND");

  const settings = await prisma.settings.findUnique({ where: { userId } });
  const categories = await prisma.category.findMany({ where: { userId } });
  const now = new Date();

  const extraction = await extractProduct(product.url, {
    defaultCurrency: settings?.currency ?? product.currency,
    categories,
    downloadImage: !product.imagePath,
    userId
  });

  if (!extraction.success || extraction.data.currentPrice === null) {
    const message =
      extraction.error ??
      extraction.warnings.find((warning) => warning.toLowerCase().includes("price")) ??
      "No valid price could be read from the store.";

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        lastCheckedAt: now,
        lastCheckStatus: "FAILED",
        lastCheckError: message.slice(0, 500),
        availability: extraction.data.availability ?? product.availability
      },
      include: productInclude
    });

    return {
      success: false,
      message,
      warnings: extraction.warnings,
      product: serializeProduct(updated)
    };
  }

  const newPrice = roundMoney(extraction.data.currentPrice);
  const extractedOriginal =
    extraction.data.originalPrice !== null && extraction.data.originalPrice > newPrice
      ? roundMoney(extraction.data.originalPrice)
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.product.update({
      where: { id: product.id },
      data: {
        currentPrice: newPrice,
        originalPrice: extractedOriginal ?? product.originalPrice,
        currency: extraction.data.currency || product.currency,
        availability: extraction.data.availability ?? product.availability,
        imagePath: !product.imagePath && extraction.data.imagePath ? extraction.data.imagePath : product.imagePath,
        imageSourceUrl:
          !product.imagePath && extraction.data.imageSourceUrl
            ? extraction.data.imageSourceUrl
            : product.imageSourceUrl,
        lastCheckedAt: now,
        lastCheckStatus: "SUCCESS",
        lastCheckError: null,
        lastPriceCheckAt: now
      },
      include: productInclude
    });

    await tx.priceHistory.create({
      data: {
        userId,
        productId: product.id,
        price: newPrice,
        originalPrice: extractedOriginal ?? product.originalPrice,
        currency: extraction.data.currency || product.currency,
        availability: extraction.data.availability ?? product.availability,
        source: "AUTOMATIC",
        recordedAt: now
      }
    });

    return saved;
  });

  return {
    success: true,
    message:
      product.currentPrice === newPrice
        ? "Price is up to date."
        : `Price updated from ${product.currentPrice ?? "—"} to ${newPrice} ${updated.currency}.`,
    warnings: extraction.warnings,
    product: serializeProduct(updated)
  };
}

async function runScheduledChecks() {
  if (schedulerBusy || isMaintenanceMode()) return;
  schedulerBusy = true;
  try {
    const settings = await prisma.settings.findMany({ where: { autoTrackingEnabled: true, userId: { not: null } } });
    for (const accountSettings of settings) {
      if (!accountSettings.userId) continue;
      const cutoff = new Date(Date.now() - accountSettings.priceUpdateIntervalMinutes * 60 * 1000);
      const dueProducts = await prisma.product.findMany({
        where: { userId: accountSettings.userId, autoTrack: true,
          OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cutoff } }] },
        orderBy: [{ lastCheckedAt: "asc" }, { createdAt: "asc" }], take: 4, select: { id: true }
      });
      for (const product of dueProducts) {
        try {
          await refreshProductPrice(accountSettings.userId, product.id);
        } catch (error) {
          console.error("Scheduled price check failed", product.id, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  } catch (error) {
    console.error("Price scheduler error", error);
  } finally {
    schedulerBusy = false;
  }
}

export function startPriceScheduler() {
  if (schedulerHandle) return;
  setTimeout(() => {
    void runScheduledChecks();
  }, 20_000);
  schedulerHandle = setInterval(() => {
    void runScheduledChecks();
  }, 60_000);
  console.log("Price tracking scheduler started (checks at most every minute, respecting per-product intervals).");
}

export function stopPriceScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
