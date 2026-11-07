import { z } from "zod";

export const productStatuses = ["TO_CONSIDER", "FAVORITE", "TO_BUY", "PURCHASED"] as const;
export const productStatusSchema = z.enum(productStatuses);

const optionalMoney = z
  .number({ invalid_type_error: "Enter a valid number." })
  .min(0, "Price cannot be negative.")
  .max(1_000_000_000, "Price is too large.")
  .nullable()
  .optional();

const optionalString = (max: number) => z.string().max(max).nullable().optional();

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(300),
  url: z.string().trim().min(1, "Product URL is required.").max(4000),
  description: optionalString(5000),
  imagePath: optionalString(500),
  imageSourceUrl: optionalString(4000),
  currentPrice: optionalMoney,
  originalPrice: optionalMoney,
  currency: z.string().trim().length(3).toUpperCase().default("PLN"),
  availability: optionalString(120),
  status: productStatusSchema.default("TO_CONSIDER"),
  notes: optionalString(5000),
  storeName: optionalString(120),
  storeDomain: optionalString(255),
  categoryId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).default([])
});

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(300).optional(),
  url: z.string().trim().min(1, "Product URL is required.").max(4000).optional(),
  description: optionalString(5000),
  imagePath: optionalString(500),
  imageSourceUrl: optionalString(4000),
  currentPrice: optionalMoney,
  originalPrice: optionalMoney,
  currency: z.string().trim().length(3).toUpperCase().optional(),
  availability: optionalString(120),
  status: productStatusSchema.optional(),
  notes: optionalString(5000),
  storeName: optionalString(120),
  storeDomain: optionalString(255),
  categoryId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional()
});

export const productQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.union([productStatusSchema, z.literal("ALL")]).optional().default("ALL"),
  categoryId: z.string().optional(),
  favorite: z.enum(["true", "false"]).optional(),
  sort: z.enum(["recent", "updated", "price-asc", "price-desc", "name"]).optional().default("recent"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(24)
});

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids: z.array(z.string().min(1)).min(1).max(200) }),
  z.object({
    action: z.literal("status"),
    ids: z.array(z.string().min(1)).min(1).max(200),
    status: productStatusSchema
  })
]);

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color.").default("#D9A3B0"),
  icon: z.string().trim().min(1).max(40).default("Tag")
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const settingsUpdateSchema = z.object({
  currency: z.string().trim().length(3).toUpperCase().optional(),
  defaultProductView: z.enum(["grid", "list"]).optional()
});

export const extractSchema = z.object({
  url: z.string().trim().min(1, "Paste a product link.").max(4000)
});
