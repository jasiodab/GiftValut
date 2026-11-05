import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler, AppError } from "../lib/errors";
import { groupCreateSchema, groupProductSchema, groupUpdateSchema } from "../validation/schemas";
import { productInclude, serializeProduct } from "../lib/serialize";
import { requestUserId } from "../lib/requestUser";

export const groupsRouter = Router();

groupsRouter.get("/", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const groups = await prisma.productGroup.findMany({
    where: { userId },
    include: { products: { where: { userId }, include: productInclude, orderBy: [{ currentPrice: "asc" }, { name: "asc" }] } },
    orderBy: { updatedAt: "desc" }
  });
  res.json({ groups: groups.map((group) => {
    const offers = group.products.map(serializeProduct);
    const verified = offers.filter((offer) => offer.currentPrice !== null);
    const cheapest = verified.reduce<(typeof verified)[number] | null>((best, offer) =>
      best === null || (offer.currentPrice as number) < (best.currentPrice as number) ? offer : best, null);
    return { id: group.id, name: group.name, createdAt: group.createdAt, updatedAt: group.updatedAt,
      offers, cheapestOfferId: cheapest?.id ?? null };
  }) });
}));

groupsRouter.post("/", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const payload = groupCreateSchema.parse(req.body);
  const ids = [...new Set(payload.productIds)];
  const products = await prisma.product.findMany({ where: { id: { in: ids }, userId } });
  if (products.length !== ids.length) throw new AppError(400, "One or more selected products no longer exist.", "PRODUCT_NOT_FOUND");
  if (products.some((product) => product.groupId)) throw new AppError(409,
    "One of these products already belongs to a comparison group. Remove it from that group first.", "ALREADY_GROUPED");
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.productGroup.create({ data: { userId, name: payload.name } });
    await tx.product.updateMany({ where: { id: { in: ids }, userId }, data: { groupId: created.id } });
    return created;
  });
  res.status(201).json({ group: { ...group, offers: [], cheapestOfferId: null } });
}));

groupsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const payload = groupUpdateSchema.parse(req.body);
  const existing = await prisma.productGroup.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw new AppError(404, "Comparison group not found.", "GROUP_NOT_FOUND");
  const group = await prisma.productGroup.update({ where: { id: existing.id }, data: payload });
  res.json({ group });
}));

groupsRouter.post("/:id/offers", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const payload = groupProductSchema.parse(req.body);
  const [group, product] = await Promise.all([
    prisma.productGroup.findFirst({ where: { id: req.params.id, userId } }),
    prisma.product.findFirst({ where: { id: payload.productId, userId } })
  ]);
  if (!group) throw new AppError(404, "Comparison group not found.", "GROUP_NOT_FOUND");
  if (!product) throw new AppError(404, "Product not found.", "PRODUCT_NOT_FOUND");
  if (product.groupId && product.groupId !== group.id) throw new AppError(409,
    "That product is already in another comparison group.", "ALREADY_GROUPED");
  await prisma.product.update({ where: { id: product.id }, data: { groupId: group.id } });
  res.json({ added: true });
}));

groupsRouter.delete("/:id/offers/:productId", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const product = await prisma.product.findFirst({ where: { id: req.params.productId, userId } });
  if (!product) throw new AppError(404, "Product not found.", "PRODUCT_NOT_FOUND");
  if (product.groupId !== req.params.id) throw new AppError(400, "That product is not in this group.", "NOT_IN_GROUP");
  const group = await prisma.productGroup.findFirst({ where: { id: req.params.id, userId } });
  if (!group) throw new AppError(404, "Comparison group not found.", "GROUP_NOT_FOUND");
  await prisma.product.update({ where: { id: product.id }, data: { groupId: null } });
  res.json({ removed: true });
}));

groupsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const group = await prisma.productGroup.findFirst({ where: { id: req.params.id, userId } });
  if (!group) throw new AppError(404, "Comparison group not found.", "GROUP_NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { groupId: group.id, userId }, data: { groupId: null } });
    await tx.productGroup.delete({ where: { id: group.id } });
  });
  res.json({ deleted: true });
}));
