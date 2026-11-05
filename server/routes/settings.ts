import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { asyncHandler, AppError } from "../lib/errors";
import { settingsUpdateSchema } from "../validation/schemas";
import { DATABASE_PATH, UPLOAD_DIR, BACKUP_DIR } from "../lib/paths";
import { uploadsSize } from "../services/images";
import { createBackupFile, listBackups, restoreBackup } from "../services/backup";
import { requireAuth, requireOwner } from "../middleware/auth";
import { requestUserId } from "../lib/requestUser";

export const settingsRouter = Router();
const restoreUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 250 * 1024 * 1024, files: 1 } });

async function getSettings(userId: string) {
  return prisma.settings.upsert({ where: { userId }, update: {}, create: { userId } });
}

async function fileSize(filePath: string): Promise<number> {
  try { return (await fs.stat(filePath)).size; } catch { return 0; }
}

settingsRouter.get("/", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const isOwner = (req as any).user.role === "OWNER";
  const settings = await getSettings(userId);
  const [productCount, categoryCount, storeCount, historyCount, groupCount, tagCount, ownedUploads] = await Promise.all([
    prisma.product.count({ where: { userId } }), prisma.category.count({ where: { userId } }),
    prisma.store.count({ where: { userId } }), prisma.priceHistory.count({ where: { userId } }),
    prisma.productGroup.count({ where: { userId } }), prisma.tag.count({ where: { userId } }),
    prisma.upload.findMany({ where: { userId }, select: { filename: true } })
  ]);
  const backups = isOwner ? await listBackups() : [];
  const [dbSize, imagesSize] = isOwner
    ? await Promise.all([fileSize(DATABASE_PATH), uploadsSize()])
    : [0, await uploadsSize(ownedUploads.map((entry) => entry.filename))];
  res.json({
    isOwner,
    settings,
    database: {
      path: isOwner ? "data/gift-vault.db" : "",
      size: dbSize,
      uploadsPath: isOwner ? "data/uploads" : "",
      uploadsSize: imagesSize,
      counts: { products: productCount, categories: categoryCount, stores: storeCount,
        priceHistory: historyCount, groups: groupCount, tags: tagCount }
    },
    backups,
    app: { name: "Gift Vault", version: "1.0.0", runtime: `Node.js ${process.version}`,
      storage: "SQLite with private account data", backupDirectory: isOwner ? "data/backups" : "" }
  });
}));

settingsRouter.patch("/", asyncHandler(async (req, res) => {
  const userId = requestUserId(req);
  const payload = settingsUpdateSchema.parse(req.body);
  await getSettings(userId);
  const settings = await prisma.settings.update({ where: { userId }, data: payload });
  res.json({ settings });
}));

settingsRouter.get("/backup", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const backup = await createBackupFile(true, requestUserId(req));
  res.download(backup.filePath, backup.filename);
}));

settingsRouter.get("/backups", requireAuth, requireOwner, asyncHandler(async (_req, res) => {
  res.json({ backups: await listBackups() });
}));

settingsRouter.get("/backups/:filename", requireAuth, requireOwner, asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.startsWith("gift-vault-backup-") || !filename.endsWith(".zip")) {
    throw new AppError(400, "Invalid backup filename.", "INVALID_BACKUP");
  }
  const filePath = path.join(BACKUP_DIR, filename);
  try { await fs.access(filePath); } catch { throw new AppError(404, "Backup not found.", "BACKUP_NOT_FOUND"); }
  res.download(filePath, filename);
}));

settingsRouter.post("/restore", requireAuth, requireOwner, restoreUpload.single("backup"), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "Choose a backup ZIP file.", "INVALID_BACKUP");
  const result = await restoreBackup(req.file.buffer);
  res.json(result);
}));

settingsRouter.get("/info", requireAuth, requireOwner, asyncHandler(async (_req, res) => {
  const [dbSize, imagesSize] = await Promise.all([fileSize(DATABASE_PATH), uploadsSize()]);
  res.json({ databasePath: DATABASE_PATH, databaseSize: dbSize, uploadsPath: UPLOAD_DIR, uploadsSize: imagesSize });
}));
