import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, AppError } from "../lib/errors";
import { searchProductPrices } from "../pricing/search";
import { providers } from "../pricing/providers";
import { priceCache } from "../pricing/cache";
import { requestUserId } from "../lib/requestUser";

export const pricingRouter = Router();
const idParam = z.object({ productId: z.string().min(1) });

pricingRouter.get("/providers", asyncHandler(async (_req, res) => {
  res.json({ providers: providers.map((p) => ({ provider: p.name, configured: p.isConfigured(), message: p.configurationMessage() })) });
}));

pricingRouter.post("/products/:productId/search", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const { productId } = idParam.parse(req.params);
  const force = req.query.force === "true";
  if (force) priceCache.delete(`price:${userId}:${productId}`);
  const result = await searchProductPrices(userId, productId, force);
  res.json(result);
}));

pricingRouter.get("/products/:productId/offers", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const { productId } = idParam.parse(req.params);
  const product = await prisma.product.findFirst({ where: { id: productId, userId }, select: { id: true } });
  if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
  const offers = await prisma.priceOffer.findMany({ where: { productId, userId }, orderBy: [{ latestTotalPriceCents: "asc" }, { matchScore: "desc" }] });
  res.json({ offers });
}));

pricingRouter.get("/products/:productId/history", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const { productId } = idParam.parse(req.params);
  const product = await prisma.product.findFirst({ where: { id: productId, userId }, select: { id: true } });
  if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
  // Keep only the most recent snapshots per offer to bound payload size.
  const offers = await prisma.priceOffer.findMany({
    where: { productId, userId },
    include: { snapshots: { orderBy: { observedAt: "desc" }, take: 200 } }
  });
  res.json({
    offers: offers.map((offer) => ({ ...offer, snapshots: [...offer.snapshots].reverse() }))
  });
}));

pricingRouter.get("/products/:productId/best-price", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const { productId } = idParam.parse(req.params);
  const product = await prisma.product.findFirst({ where: { id: productId, userId }, select: { id: true } });
  if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
  const offer = await prisma.priceOffer.findFirst({
    where: { productId, userId, matchStatus: { in: ["CONFIRMED", "PENDING"] } },
    orderBy: [{ latestTotalPriceCents: "asc" }, { matchScore: "desc" }]
  });
  res.json({ offer });
}));

pricingRouter.get("/checks/:checkId", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const checkId = z.string().min(1).parse(req.params.checkId);
  const check = await prisma.priceCheck.findFirst({ where: { id: checkId, userId }, include: { runs: true } });
  if (!check) throw new AppError(404, "Check not found", "NOT_FOUND");
  res.json({ check });
}));

async function changeOfferStatus(userId: string, offerId: string, matchStatus: "CONFIRMED" | "REJECTED") {
  const offer = await prisma.priceOffer.findFirst({ where: { id: offerId, userId }, select: { id: true } });
  if (!offer) throw new AppError(404, "Offer not found", "NOT_FOUND");
  return prisma.priceOffer.update({
    where: { id: offer.id },
    data: matchStatus === "CONFIRMED"
      ? { matchStatus, confirmedAt: new Date(), rejectedAt: null }
      : { matchStatus, rejectedAt: new Date() }
  });
}

pricingRouter.post("/offers/:offerId/confirm", asyncHandler(async (req, res) => {
  const offer = await changeOfferStatus(requestUserId(req), z.string().min(1).parse(req.params.offerId), "CONFIRMED");
  res.json({ offer });
}));

pricingRouter.post("/offers/:offerId/reject", asyncHandler(async (req, res) => {
  const offer = await changeOfferStatus(requestUserId(req), z.string().min(1).parse(req.params.offerId), "REJECTED");
  res.json({ offer });
}));
