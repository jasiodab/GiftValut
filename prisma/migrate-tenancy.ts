import path from "node:path";
import { prisma } from "../server/lib/prisma";
import { ensureAccountDefaults } from "../server/services/accountDefaults";

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  const owner = users.find((user) => user.role === "OWNER") ?? users[0];
  if (!owner) throw new Error("No user exists; create the owner account before migrating tenancy.");

  // Preserve assigned records; attach only legacy unowned records to the owner.
  await prisma.$transaction([
    prisma.product.updateMany({ where: { userId: null }, data: { userId: owner.id } }),
    prisma.category.updateMany({ where: { userId: null }, data: { userId: owner.id } }),
    prisma.tag.updateMany({ where: { userId: null }, data: { userId: owner.id } }),
    prisma.productGroup.updateMany({ where: { userId: null }, data: { userId: owner.id } }),
    prisma.settings.updateMany({ where: { userId: null }, data: { userId: owner.id } })
  ]);

  const products = await prisma.product.findMany({
    select: { id: true, userId: true, imagePath: true, storeId: true }
  });
  const productUser = new Map(products.map((product) => [product.id, product.userId ?? owner.id]));

  const history = await prisma.priceHistory.findMany({ where: { userId: null }, select: { id: true, productId: true } });
  for (const row of history) await prisma.priceHistory.update({ where: { id: row.id }, data: { userId: productUser.get(row.productId) ?? owner.id } });
  const checks = await prisma.priceCheck.findMany({ where: { userId: null }, select: { id: true, productId: true } });
  for (const row of checks) await prisma.priceCheck.update({ where: { id: row.id }, data: { userId: productUser.get(row.productId) ?? owner.id } });
  const offers = await prisma.priceOffer.findMany({ where: { userId: null }, select: { id: true, productId: true } });
  for (const row of offers) await prisma.priceOffer.update({ where: { id: row.id }, data: { userId: productUser.get(row.productId) ?? owner.id } });

  // A legacy store can be shared by products from several accounts. Split it so
  // each account keeps its own store record and no relation crosses accounts.
  const stores = await prisma.store.findMany({ include: { products: { select: { id: true, userId: true } } } });
  for (const store of stores) {
    const buckets = new Map<string, string[]>();
    for (const product of store.products) {
      const userId = product.userId ?? owner.id;
      buckets.set(userId, [...(buckets.get(userId) ?? []), product.id]);
    }
    if (!buckets.size) {
      await prisma.store.update({ where: { id: store.id }, data: { userId: store.userId ?? owner.id } });
      continue;
    }
    const [firstUserId, firstProductIds] = [...buckets.entries()][0];
    await prisma.store.update({ where: { id: store.id }, data: { userId: firstUserId } });
    for (const [userId, productIds] of [...buckets.entries()].slice(1)) {
      const clone = await prisma.store.create({ data: { userId, name: store.name, domain: store.domain } });
      await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { storeId: clone.id } });
    }
    await prisma.product.updateMany({ where: { id: { in: firstProductIds } }, data: { storeId: store.id } });
  }

  for (const product of products) {
    if (!product.imagePath) continue;
    const filename = path.basename(product.imagePath);
    await prisma.upload.upsert({
      where: { filename_userId: { filename, userId: product.userId ?? owner.id } },
      update: {},
      create: { filename, userId: product.userId ?? owner.id }
    });
  }

  for (const user of users) await ensureAccountDefaults(user.id);
  console.log(`Tenancy migration complete for ${users.length} account(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
