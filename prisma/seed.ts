import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../server/services/accountDefaults";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await prisma.settings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id }
    });

    for (const category of DEFAULT_CATEGORIES) {
      await prisma.category.upsert({
        where: { userId_slug: { userId: user.id, slug: category.slug } },
        update: {},
        create: { ...category, userId: user.id, isDefault: true }
      });
    }
  }
  console.log(`Ensured default data for ${users.length} user accounts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
