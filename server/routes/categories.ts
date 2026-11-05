import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler, AppError } from "../lib/errors";
import { categoryCreateSchema, categoryUpdateSchema } from "../validation/schemas";
import { requestUserId } from "../lib/requestUser";

export const categoriesRouter = Router();

function slugify(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[łŁ]/g, "l")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "category";
}

categoriesRouter.get("/", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const [categories, grouped] = await Promise.all([
    prisma.category.findMany({ where: { userId }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.product.groupBy({
      by: ["categoryId"], where: { userId }, _count: { _all: true }, _sum: { currentPrice: true }
    })
  ]);
  const stats = new Map(grouped.map((entry) => [entry.categoryId, entry]));
  res.json({ categories: categories.map((category) => ({
    ...category,
    productCount: stats.get(category.id)?._count._all ?? 0,
    totalValue: stats.get(category.id)?._sum.currentPrice ?? 0
  })) });
}));

categoriesRouter.post("/", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const payload = categoryCreateSchema.parse(req.body);
  if (await prisma.category.findFirst({ where: { userId, name: payload.name } })) {
    throw new AppError(409, "A category with that name already exists.", "DUPLICATE_CATEGORY");
  }
  const baseSlug = slugify(payload.name);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.category.findFirst({ where: { userId, slug } })) slug = `${baseSlug}-${suffix++}`;
  const max = await prisma.category.aggregate({ where: { userId }, _max: { sortOrder: true } });
  const category = await prisma.category.create({ data: {
    userId, name: payload.name, color: payload.color, icon: payload.icon, slug,
    sortOrder: (max._max.sortOrder ?? 0) + 10
  } });
  res.status(201).json({ category: { ...category, productCount: 0, totalValue: 0 } });
}));

categoriesRouter.patch("/:id", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const payload = categoryUpdateSchema.parse(req.body);
  const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) throw new AppError(404, "Category not found.", "CATEGORY_NOT_FOUND");
  if (payload.name && payload.name !== existing.name &&
      await prisma.category.findFirst({ where: { userId, name: payload.name } })) {
    throw new AppError(409, "A category with that name already exists.", "DUPLICATE_CATEGORY");
  }
  const category = await prisma.category.update({ where: { id: existing.id }, data: payload });
  const [count, total] = await Promise.all([
    prisma.product.count({ where: { userId, categoryId: category.id } }),
    prisma.product.aggregate({ where: { userId, categoryId: category.id }, _sum: { currentPrice: true } })
  ]);
  res.json({ category: { ...category, productCount: count, totalValue: total._sum.currentPrice ?? 0 } });
}));

categoriesRouter.delete("/:id", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const category = await prisma.category.findFirst({
    where: { id: req.params.id, userId }, include: { _count: { select: { products: true } } }
  });
  if (!category) throw new AppError(404, "Category not found.", "CATEGORY_NOT_FOUND");
  if (category.slug === "other") throw new AppError(400, "The Other category is the fallback and cannot be deleted.", "CATEGORY_REQUIRED");
  if (category._count.products > 0) throw new AppError(409,
    `This category still contains ${category._count.products} product${category._count.products === 1 ? "" : "s"}. Move them before deleting it.`,
    "CATEGORY_IN_USE");
  await prisma.category.delete({ where: { id: category.id } });
  res.json({ deleted: true });
}));

export const tagsRouter = Router();
tagsRouter.get("/", asyncHandler(async (req, res) => {
  const tags = await prisma.tag.findMany({
    where: { userId: requestUserId(req) }, include: { _count: { select: { products: true } } }, orderBy: { name: "asc" }
  });
  res.json({ tags: tags.map((tag) => ({ id: tag.id, name: tag.name, count: tag._count.products })) });
}));
