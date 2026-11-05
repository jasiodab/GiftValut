import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { cleanupExpiredSessions } from "./lib/auth";

const port = Number(process.env.PORT ?? 3001);
const frogMode = process.env.FROG_MODE === "true";

async function main() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  // Initialize SQLite for stable long-running operation. journal_mode is persisted
  // in the database file; busy_timeout is applied to this connection.
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  } catch (error) {
    console.warn("Could not initialize SQLite PRAGMA settings.", error);
  }

  await cleanupExpiredSessions(true).catch((error) => {
    console.warn("Initial expired session cleanup failed.", error);
  });

  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`Gift Vault API listening on http://localhost:${port}${frogMode ? " (FROG MODE)" : ""}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down Gift Vault...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (error) => {
  console.error("Gift Vault failed to start.");
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

