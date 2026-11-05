import { Router } from "express";
import { asyncHandler } from "../lib/errors";
import { extractSchema } from "../validation/schemas";
import { extractProduct } from "../services/extraction";
import { prisma } from "../lib/prisma";
import { requestUserId } from "../lib/requestUser";

export const extractRouter = Router();

extractRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { url } = extractSchema.parse(req.body);
    const userId = requestUserId(req);
    const [categories, settings] = await Promise.all([
      prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.settings.findUnique({ where: { userId } })
    ]);

    const result = await extractProduct(url, {
      defaultCurrency: settings?.currency ?? "PLN",
      categories,
      downloadImage: true,
      userId
    });

    res.json(result);
  })
);
