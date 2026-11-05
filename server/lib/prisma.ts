import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __giftVaultPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__giftVaultPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.__giftVaultPrisma = prisma;
}
