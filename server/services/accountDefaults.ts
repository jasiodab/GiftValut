import { prisma } from "../lib/prisma";

export const DEFAULT_CATEGORIES = [
  { name: "Jewelry", slug: "jewelry", color: "#C9A46A", icon: "Gem", sortOrder: 10 },
  { name: "Cosmetics", slug: "cosmetics", color: "#D9A3B0", icon: "Sparkles", sortOrder: 20 },
  { name: "Fashion", slug: "fashion", color: "#B7A5C9", icon: "Shirt", sortOrder: 30 },
  { name: "Electronics", slug: "electronics", color: "#8FAFC4", icon: "Headphones", sortOrder: 40 },
  { name: "Games", slug: "games", color: "#9DB8A4", icon: "Gamepad2", sortOrder: 50 },
  { name: "Books", slug: "books", color: "#C4A484", icon: "BookOpen", sortOrder: 60 },
  { name: "Home & Decor", slug: "home-decor", color: "#B4B8A5", icon: "Lamp", sortOrder: 70 },
  { name: "Flowers", slug: "flowers", color: "#E0A5A5", icon: "Flower2", sortOrder: 80 },
  { name: "Experiences", slug: "experiences", color: "#88B7B0", icon: "Ticket", sortOrder: 90 },
  { name: "Food & Sweets", slug: "food-sweets", color: "#D6A878", icon: "CakeSlice", sortOrder: 100 },
  { name: "Other", slug: "other", color: "#A8A29E", icon: "Tag", sortOrder: 110 }
] as const;

export async function ensureAccountDefaults(userId: string) {
  await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_slug: { userId, slug: category.slug } },
      update: {},
      create: { ...category, userId, isDefault: true }
    });
  }
}
