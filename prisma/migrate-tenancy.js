const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const defaults = [
  ["Jewelry", "jewelry", "#C9A46A", "Gem", 10], ["Cosmetics", "cosmetics", "#D9A3B0", "Sparkles", 20],
  ["Fashion", "fashion", "#B7A5C9", "Shirt", 30], ["Electronics", "electronics", "#8FAFC4", "Headphones", 40],
  ["Games", "games", "#9DB8A4", "Gamepad2", 50], ["Books", "books", "#C4A484", "BookOpen", 60],
  ["Home & Decor", "home-decor", "#B4B8A5", "Lamp", 70], ["Flowers", "flowers", "#E0A5A5", "Flower2", 80],
  ["Experiences", "experiences", "#88B7B0", "Ticket", 90], ["Food & Sweets", "food-sweets", "#D6A878", "CakeSlice", 100],
  ["Other", "other", "#A8A29E", "Tag", 110]
];

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  const owner = users.find((u) => u.role === "OWNER") || users[0];
  if (!owner) throw new Error("No user exists. Create the owner account before migrating.");

  for (const model of [prisma.product, prisma.category, prisma.tag, prisma.productGroup, prisma.settings]) {
    await model.updateMany({ where: { userId: null }, data: { userId: owner.id } });
  }
  const products = await prisma.product.findMany({ select: { id: true, userId: true, imagePath: true } });
  const owners = new Map(products.map((p) => [p.id, p.userId || owner.id]));
  const history = await prisma.priceHistory.findMany({ where: { userId: null }, select: { id: true, productId: true } });
  for (const row of history) await prisma.priceHistory.update({ where: { id: row.id }, data: { userId: owners.get(row.productId) || owner.id } });
  const checks = await prisma.priceCheck.findMany({ where: { userId: null }, select: { id: true, productId: true } });
  for (const row of checks) await prisma.priceCheck.update({ where: { id: row.id }, data: { userId: owners.get(row.productId) || owner.id } });
  const offers = await prisma.priceOffer.findMany({ where: { userId: null }, select: { id: true, productId: true } });
  for (const row of offers) await prisma.priceOffer.update({ where: { id: row.id }, data: { userId: owners.get(row.productId) || owner.id } });

  const stores = await prisma.store.findMany({ include: { products: { select: { id: true, userId: true } } } });
  for (const store of stores) {
    const buckets = new Map();
    for (const product of store.products) {
      const userId = product.userId || owner.id;
      buckets.set(userId, [...(buckets.get(userId) || []), product.id]);
    }
    if (!buckets.size) {
      await prisma.store.update({ where: { id: store.id }, data: { userId: store.userId || owner.id } });
      continue;
    }
    const entries = [...buckets.entries()];
    const [firstUserId, firstIds] = entries[0];
    await prisma.store.update({ where: { id: store.id }, data: { userId: firstUserId } });
    await prisma.product.updateMany({ where: { id: { in: firstIds } }, data: { storeId: store.id } });
    for (const [userId, ids] of entries.slice(1)) {
      const clone = await prisma.store.create({ data: { userId, name: store.name, domain: store.domain } });
      await prisma.product.updateMany({ where: { id: { in: ids } }, data: { storeId: clone.id } });
    }
  }

  for (const product of products) {
    if (!product.imagePath) continue;
    const filename = path.basename(product.imagePath);
    await prisma.upload.upsert({
      where: { filename_userId: { filename, userId: product.userId || owner.id } },
      update: {}, create: { filename, userId: product.userId || owner.id }
    });
  }
  for (const user of users) {
    await prisma.settings.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
    for (const [name, slug, color, icon, sortOrder] of defaults) {
      await prisma.category.upsert({
        where: { userId_slug: { userId: user.id, slug } }, update: {},
        create: { userId: user.id, name, slug, color, icon, sortOrder, isDefault: true }
      });
    }
  }
  console.log(`Tenancy migration complete for ${users.length} account(s).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
