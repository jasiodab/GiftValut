import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { normalizeProductUrl } from "./urlSafety";
import { deleteLocalImage } from "./images";
import { productInclude, serializeProduct } from "../lib/serialize";
import { roundMoney } from "../lib/money";

type ProductInput = {
  name: string;
  url: string;
  description?: string | null;
  imagePath?: string | null;
  imageSourceUrl?: string | null;
  currentPrice?: number | null;
  originalPrice?: number | null;
  currency?: string;
  availability?: string | null;
  status?: string;
  notes?: string | null;
  storeName?: string | null;
  storeDomain?: string | null;
  categoryId?: string;
  tags?: string[];
};

function cleanOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function normalizeImagePath(value: string | null | undefined): string | null {
  const cleaned = cleanOptional(value);
  if (!cleaned) return null;
  if (!cleaned.startsWith("/uploads/")) {
    throw new AppError(400, "Images must be stored in the local uploads folder.", "INVALID_IMAGE_PATH");
  }
  const filename = path.basename(cleaned);
  if (!filename || filename === "." || filename === "..") {
    throw new AppError(400, "Invalid image reference.", "INVALID_IMAGE_PATH");
  }
  return `/uploads/${filename}`;
}

async function assertOwnedImage(userId: string, imagePath: string | null): Promise<string | null> {
  if (!imagePath) return null;
  const filename = path.basename(imagePath);
  const upload = await prisma.upload.findFirst({ where: { filename, userId }, select: { id: true } });
  if (!upload) {
    throw new AppError(400, "The selected image is not available in your account.", "INVALID_IMAGE_PATH");
  }
  return imagePath;
}

function cleanTagNames(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().slice(0, 40);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase("pl");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result.slice(0, 15);
}

function domainFromInput(storeDomain: string | null | undefined, url: string): string {
  const candidate = cleanOptional(storeDomain);
  if (candidate) {
    try {
      const parsed = candidate.includes("://") ? new URL(candidate) : new URL(`https://${candidate}`);
      return parsed.hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      // Fall through to the product URL.
    }
  }
  return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
}

function titleFromDomain(domain: string): string {
  const core = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  return core
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function resolveCategory(userId: string, categoryId: string | undefined) {
  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new AppError(400, "The selected category no longer exists.", "INVALID_CATEGORY");
    return category;
  }
  const other = await prisma.category.findFirst({ where: { userId, slug: "other" } });
  const fallback = other ?? (await prisma.category.findFirst({ where: { userId }, orderBy: { sortOrder: "asc" } }));
  if (!fallback) throw new AppError(500, "No categories exist in the database.", "NO_CATEGORIES");
  return fallback;
}

async function resolveStore(
  userId: string,
  storeName: string | null | undefined,
  storeDomain: string | null | undefined,
  url: string
) {
  const domain = domainFromInput(storeDomain, url);
  const requestedName = cleanOptional(storeName) ?? titleFromDomain(domain);

  return prisma.store.upsert({
    where: { userId_domain: { userId, domain } },
    update: { name: requestedName },
    create: { userId, domain, name: requestedName }
  });
}

function tagCreateData(userId: string, tags: string[]): Prisma.ProductTagCreateWithoutProductInput[] {
  return tags.map((name) => ({
    tag: {
      connectOrCreate: {
        where: { userId_name: { userId, name } },
        create: { userId, name }
      }
    }
  }));
}

export async function createProduct(userId: string, input: ProductInput) {
  const { url, normalizedUrl } = normalizeProductUrl(input.url);

  const duplicate = await prisma.product.findFirst({
    where: { userId, normalizedUrl },
    include: { category: true, store: true }
  });
  if (duplicate) {
    throw new AppError(409, "This product URL is already in your vault.", "DUPLICATE_PRODUCT", {
      productId: duplicate.id,
      productName: duplicate.name
    });
  }

  const category = await resolveCategory(userId, input.categoryId);
  const store = await resolveStore(userId, input.storeName, input.storeDomain, url);
  const tags = cleanTagNames(input.tags);
  const imagePath = await assertOwnedImage(userId, normalizeImagePath(input.imagePath));
  const price = input.currentPrice ?? null;

  const product = await prisma.product.create({
    data: {
      userId,
      name: input.name.trim(),
      url,
      normalizedUrl,
      description: cleanOptional(input.description),
      imagePath,
      imageSourceUrl: cleanOptional(input.imageSourceUrl),
      currentPrice: price !== null ? roundMoney(price) : null,
      originalPrice: input.originalPrice !== null && input.originalPrice !== undefined ? roundMoney(input.originalPrice) : null,
      currency: input.currency ?? "PLN",
      availability: cleanOptional(input.availability),
      status: input.status ?? "TO_CONSIDER",
      notes: cleanOptional(input.notes),
      storeId: store.id,
      categoryId: category.id,
      tags: tags.length ? { create: tagCreateData(userId, tags) } : undefined
    },
    include: productInclude
  });

  return serializeProduct(product);
}

export async function updateProduct(userId: string, id: string, input: Partial<ProductInput>) {
  const existing = await prisma.product.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError(404, "Product not found.", "PRODUCT_NOT_FOUND");

  let url = existing.url;
  let normalizedUrl = existing.normalizedUrl;
  if (input.url !== undefined) {
    const normalized = normalizeProductUrl(input.url);
    url = normalized.url;
    normalizedUrl = normalized.normalizedUrl;
    const duplicate = await prisma.product.findFirst({
      where: { userId, normalizedUrl, id: { not: id } }
    });
    if (duplicate) {
      throw new AppError(409, "Another product already uses this URL.", "DUPLICATE_PRODUCT", {
        productId: duplicate.id,
        productName: duplicate.name
      });
    }
  }

  const data: Prisma.ProductUpdateInput = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.url !== undefined) {
    data.url = url;
    data.normalizedUrl = normalizedUrl;
  }
  if (input.description !== undefined) data.description = cleanOptional(input.description);
  if (input.imagePath !== undefined) {
    const nextImagePath = normalizeImagePath(input.imagePath);
    // Only require a fresh ownership proof when the image actually changes;
    // legacy products may reference images uploaded before Upload tracking.
    if (nextImagePath && nextImagePath !== existing.imagePath) {
      await assertOwnedImage(userId, nextImagePath);
    }
    data.imagePath = nextImagePath;
  }
  if (input.imageSourceUrl !== undefined) data.imageSourceUrl = cleanOptional(input.imageSourceUrl);
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.availability !== undefined) data.availability = cleanOptional(input.availability);
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = cleanOptional(input.notes);

  if (input.categoryId !== undefined) {
    const category = await resolveCategory(userId, input.categoryId);
    data.category = { connect: { id: category.id } };
  }

  if (input.storeName !== undefined || input.storeDomain !== undefined || input.url !== undefined) {
    const store = await resolveStore(
      userId,
      input.storeName ?? (existing.storeId ? (await prisma.store.findFirst({ where: { id: existing.storeId, userId } }))?.name : null),
      input.storeDomain,
      url
    );
    data.store = { connect: { id: store.id } };
  }

  if (input.currentPrice !== undefined) {
    data.currentPrice = input.currentPrice === null ? null : roundMoney(input.currentPrice);
  }
  if (input.originalPrice !== undefined) {
    data.originalPrice = input.originalPrice === null ? null : roundMoney(input.originalPrice);
  }

  let previousTagIds: string[] = [];
  if (input.tags !== undefined) {
    const tags = cleanTagNames(input.tags);
    previousTagIds = (
      await prisma.productTag.findMany({ where: { productId: id }, select: { tagId: true } })
    ).map((entry) => entry.tagId);
    data.tags = {
      deleteMany: {},
      create: tagCreateData(userId, tags)
    };
  }

  const oldImage = existing.imagePath;
  const updated = await prisma.product.update({
    where: { id },
    data,
    include: productInclude
  });

  if (oldImage && updated.imagePath !== oldImage) {
    const [stillUsed, stillUsedAnywhere] = await Promise.all([
      prisma.product.count({ where: { imagePath: oldImage, userId } }),
      prisma.product.count({ where: { imagePath: oldImage } })
    ]);
    if (!stillUsed) {
      await prisma.upload.deleteMany({ where: { filename: path.basename(oldImage), userId } });
    }
    if (!stillUsedAnywhere) {
      await deleteLocalImage(oldImage);
    }
  }

  if (previousTagIds.length) {
    await prisma.tag.deleteMany({
      where: { id: { in: previousTagIds }, userId, products: { none: {} } }
    });
  }

  return serializeProduct(updated);
}

export async function deleteProduct(userId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, userId },
    include: { tags: { include: { tag: { include: { _count: { select: { products: true } } } } } } }
  });
  if (!product) throw new AppError(404, "Product not found.", "PRODUCT_NOT_FOUND");

  await prisma.product.delete({ where: { id } });

  if (product.imagePath) {
    const [stillUsed, stillUsedAnywhere] = await Promise.all([
      prisma.product.count({ where: { imagePath: product.imagePath, userId } }),
      prisma.product.count({ where: { imagePath: product.imagePath } })
    ]);
    if (!stillUsed) {
      await prisma.upload.deleteMany({ where: { filename: path.basename(product.imagePath), userId } });
    }
    if (!stillUsedAnywhere) {
      await deleteLocalImage(product.imagePath);
    }
  }

  const orphanTagIds = product.tags
    .filter((productTag) => productTag.tag._count.products <= 1)
    .map((productTag) => productTag.tagId);
  if (orphanTagIds.length) {
    await prisma.tag.deleteMany({ where: { id: { in: orphanTagIds }, userId } });
  }
}

export async function deleteProductsBulk(userId: string, ids: string[]): Promise<number> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return 0;

  const products = await prisma.product.findMany({
    where: { id: { in: uniqueIds }, userId },
    select: { id: true, imagePath: true }
  });
  if (!products.length) return 0;

  const productIds = products.map((product) => product.id);
  const affectedTags = await prisma.productTag.findMany({
    where: { productId: { in: productIds } },
    select: { tagId: true }
  });
  const affectedTagIds = [...new Set(affectedTags.map((entry) => entry.tagId))];

  const imagePaths = [...new Set(products.map((product) => product.imagePath).filter(Boolean))] as string[];

  await prisma.product.deleteMany({
    where: { id: { in: productIds }, userId }
  });

  if (affectedTagIds.length) {
    await prisma.tag.deleteMany({
      where: { id: { in: affectedTagIds }, userId, products: { none: {} } }
    });
  }

  if (imagePaths.length) {
    const [stillUsed, stillUsedAnywhere] = await Promise.all([
      prisma.product.findMany({
        where: { imagePath: { in: imagePaths }, userId },
        select: { imagePath: true }
      }),
      prisma.product.findMany({
        where: { imagePath: { in: imagePaths } },
        select: { imagePath: true }
      })
    ]);
    const usedPaths = new Set(stillUsed.map((product) => product.imagePath).filter(Boolean));
    const usedPathsAnywhere = new Set(
      stillUsedAnywhere.map((product) => product.imagePath).filter(Boolean)
    );
    const unusedByUser = imagePaths.filter((imagePath) => !usedPaths.has(imagePath));
    if (unusedByUser.length) {
      await prisma.upload.deleteMany({
        where: { userId, filename: { in: unusedByUser.map((imagePath) => path.basename(imagePath)) } }
      });
    }
    for (const imagePath of imagePaths) {
      if (!usedPathsAnywhere.has(imagePath)) {
        await deleteLocalImage(imagePath);
      }
    }
  }

  return products.length;
}

export async function duplicateProductCheck(userId: string, url: string) {
  const { normalizedUrl } = normalizeProductUrl(url);
  const existing = await prisma.product.findFirst({
    where: { userId, normalizedUrl },
    select: { id: true, name: true, createdAt: true }
  });
  return existing;
}
