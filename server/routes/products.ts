import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, AppError } from "../lib/errors";
import {
  bulkActionSchema,
  productCreateSchema,
  productQuerySchema,
  productUpdateSchema
} from "../validation/schemas";
import { createProduct, deleteProduct, deleteProductsBulk, duplicateProductCheck, updateProduct } from "../services/products";
import { productInclude, serializeProduct } from "../lib/serialize";
import { requestUserId } from "../lib/requestUser";

export const productsRouter = Router();

productsRouter.get(
  "/check-url",
  asyncHandler(async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url : "";
    if (!url) throw new AppError(400, "A URL is required.", "INVALID_URL");
    const existing = await duplicateProductCheck(requestUserId(req), url);
    res.json({ duplicate: existing });
  })
);

productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = productQuerySchema.parse(req.query);
    const where: Prisma.ProductWhereInput = { userId: requestUserId(req) };

    if (query.status !== "ALL") where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.favorite === "true") where.status = "FAVORITE";
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { description: { contains: query.search } },
        { notes: { contains: query.search } },
        { store: { name: { contains: query.search } } },
        { tags: { some: { tag: { name: { contains: query.search } } } } }
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === "price-asc"
        ? [{ currentPrice: "asc" }, { createdAt: "desc" }]
        : query.sort === "price-desc"
          ? [{ currentPrice: "desc" }, { createdAt: "desc" }]
          : query.sort === "name"
            ? [{ name: "asc" }]
            : query.sort === "updated"
              ? [{ updatedAt: "desc" }]
              : [{ createdAt: "desc" }];

    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: productInclude
      })
    ]);

    res.json({
      products: products.map(serializeProduct),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    });
  })
);

productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = productCreateSchema.parse(req.body);
    const product = await createProduct(requestUserId(req), payload);
    res.status(201).json({ product });
  })
);

productsRouter.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const payload = bulkActionSchema.parse(req.body);
    if (payload.action === "delete") {
      const deleted = await deleteProductsBulk((req as any).user.id, payload.ids);
      return res.json({ deleted });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: payload.ids }, userId: requestUserId(req) },
      data: { status: payload.status }
    });
    res.json({ updated: result.count });
  })
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id, userId: requestUserId(req) },
      include: productInclude
    });

    if (!product) throw new AppError(404, "Product not found.", "PRODUCT_NOT_FOUND");

    res.json({ product: serializeProduct(product) });
  })
);

productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = productUpdateSchema.parse(req.body);
    const product = await updateProduct(requestUserId(req), req.params.id, payload);
    res.json({ product });
  })
);

productsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = requestUserId(req);
    const existingDel = await prisma.product.findFirst({ where: { id: req.params.id, userId } });
    if (!existingDel) throw new AppError(404, "Not found", "NOT_FOUND");
    await deleteProduct(userId, req.params.id);
    res.json({ deleted: true });
  })
);
