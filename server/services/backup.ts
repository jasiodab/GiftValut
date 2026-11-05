import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import archiver from "archiver";
import AdmZip from "adm-zip";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { BACKUP_DIR, DATABASE_PATH, UPLOAD_DIR, ensureDataDirectories } from "../lib/paths";
import { setMaintenanceMode } from "../lib/maintenance";

const APP_VERSION = "1.0.0";
const MAX_BACKUPS = 12;
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

export async function createBackupFile(recordTimestamp = true, userId?: string) {
  ensureDataDirectories();
  if (!fs.existsSync(DATABASE_PATH)) {
    throw new AppError(500, "The local database file was not found.", "DATABASE_MISSING");
  }

  try {
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    // A checkpoint is best-effort; the database may not be in WAL mode.
  }

  const createdAt = new Date();
  const stamp = createdAt.toISOString().replace(/[:.]/g, "-");
  const filename = `gift-vault-backup-${stamp}.zip`;
  const filePath = path.join(BACKUP_DIR, filename);
  const output = fs.createWriteStream(filePath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  await new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.file(DATABASE_PATH, { name: "gift-vault.db" });
    archive.directory(UPLOAD_DIR, "uploads");
    archive.append(
      JSON.stringify(
        {
          app: "Gift Vault",
          version: APP_VERSION,
          createdAt: createdAt.toISOString(),
          includes: ["SQLite database", "locally stored product images"]
        },
        null,
        2
      ),
      { name: "manifest.json" }
    );
    void archive.finalize();
  });

  if (recordTimestamp && userId) {
    await prisma.settings.upsert({
      where: { userId },
      update: { lastBackupAt: createdAt },
      create: { userId, lastBackupAt: createdAt }
    });
  }

  await pruneOldBackups();
  return { filePath, filename, createdAt };
}

async function pruneOldBackups() {
  try {
    const files = (await fsp.readdir(BACKUP_DIR))
      .filter((file) => file.startsWith("gift-vault-backup-") && file.endsWith(".zip"))
      .sort()
      .reverse();
    for (const file of files.slice(MAX_BACKUPS)) {
      await fsp.rm(path.join(BACKUP_DIR, file), { force: true });
    }
  } catch (error) {
    console.warn("Could not prune old backups", error);
  }
}

export async function listBackups() {
  ensureDataDirectories();
  const files = await fsp.readdir(BACKUP_DIR);
  const result = [];
  for (const file of files) {
    if (!file.endsWith(".zip") || !file.startsWith("gift-vault-backup-")) continue;
    const stats = await fsp.stat(path.join(BACKUP_DIR, file));
    result.push({ filename: file, size: stats.size, createdAt: stats.mtime });
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, MAX_BACKUPS);
}

function safeZipName(entryName: string): string {
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.includes("\0")) throw new AppError(400, "The backup contains an invalid filename.", "INVALID_BACKUP");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
    throw new AppError(400, "The backup contains an unsafe path.", "INVALID_BACKUP");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new AppError(400, "The backup contains an unsafe path.", "INVALID_BACKUP");
  }
  return segments.filter((segment) => segment && segment !== ".").join("/");
}

export async function restoreBackup(buffer: Buffer) {
  if (!buffer.length) throw new AppError(400, "Choose a backup ZIP file.", "INVALID_BACKUP");

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new AppError(400, "The uploaded file is not a valid ZIP archive.", "INVALID_BACKUP");
  }

  const entries = zip.getEntries();
  if (!entries.length) throw new AppError(400, "The backup archive is empty.", "INVALID_BACKUP");
  if (entries.length > 20_000) throw new AppError(400, "The backup contains too many files.", "INVALID_BACKUP");

  const dbEntry = entries.find((entry) => !entry.isDirectory && safeZipName(entry.entryName) === "gift-vault.db");
  if (!dbEntry) {
    throw new AppError(400, "The backup does not contain gift-vault.db.", "INVALID_BACKUP");
  }

  let dbBuffer: Buffer;
  try {
    dbBuffer = dbEntry.getData();
  } catch {
    throw new AppError(400, "The database inside the backup could not be read.", "INVALID_BACKUP");
  }

  if (dbBuffer.length < 4096 || dbBuffer.subarray(0, 16).toString("utf8") !== "SQLite format 3\u0000") {
    throw new AppError(400, "The backup does not contain a valid SQLite database.", "INVALID_BACKUP");
  }

  const restoreId = randomUUID();
  const tempDir = path.join(BACKUP_DIR, `.restore-${restoreId}`);
  const newDbPath = path.join(tempDir, "gift-vault.db");
  const stagedUploads = path.join(tempDir, "uploads");
  await fsp.mkdir(stagedUploads, { recursive: true });
  await fsp.writeFile(newDbPath, dbBuffer);

  let imageCount = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = safeZipName(entry.entryName);
    if (name === "gift-vault.db" || name === "manifest.json") continue;
    if (!name.startsWith("uploads/")) {
      throw new AppError(400, "The backup contains an unexpected file outside the uploads folder.", "INVALID_BACKUP");
    }
    const filename = path.basename(name);
    const extension = path.extname(filename).toLowerCase();
    if (filename === ".gitkeep") continue;
    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      throw new AppError(400, `Unsupported file in backup: ${filename}`, "INVALID_BACKUP");
    }
    if (entry.header.size > 20 * 1024 * 1024) {
      throw new AppError(400, `Image is too large in backup: ${filename}`, "INVALID_BACKUP");
    }
    await fsp.writeFile(path.join(stagedUploads, filename), entry.getData(), { flag: "wx" });
    imageCount += 1;
  }

  const preRestore = await createBackupFile(false);
  setMaintenanceMode(true);
  await prisma.$disconnect();

  const oldUploadsPath = path.join(BACKUP_DIR, `.uploads-old-${restoreId}`);
  const rollbackDbPath = path.join(BACKUP_DIR, `.db-rollback-${restoreId}`);
  await fsp.copyFile(DATABASE_PATH, rollbackDbPath);

  try {
    if (fs.existsSync(UPLOAD_DIR)) {
      await fsp.rename(UPLOAD_DIR, oldUploadsPath);
    }
    await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    const restoredFiles = await fsp.readdir(stagedUploads);
    for (const file of restoredFiles) {
      await fsp.copyFile(path.join(stagedUploads, file), path.join(UPLOAD_DIR, file));
    }

    await fsp.copyFile(newDbPath, DATABASE_PATH);
    await fsp.rm(`${DATABASE_PATH}-wal`, { force: true });
    await fsp.rm(`${DATABASE_PATH}-shm`, { force: true });

    await prisma.$connect();
    await prisma.settings.findFirstOrThrow();
    await prisma.product.count();

    await fsp.rm(oldUploadsPath, { recursive: true, force: true });
    await fsp.rm(rollbackDbPath, { force: true });
    await fsp.rm(tempDir, { recursive: true, force: true });

    return {
      restored: true,
      images: imageCount,
      safetyBackup: preRestore.filename
    };
  } catch (error) {
    await prisma.$disconnect().catch(() => undefined);
    await fsp.copyFile(rollbackDbPath, DATABASE_PATH).catch(() => undefined);
    await fsp.rm(UPLOAD_DIR, { recursive: true, force: true }).catch(() => undefined);
    if (fs.existsSync(oldUploadsPath)) {
      await fsp.rename(oldUploadsPath, UPLOAD_DIR).catch(() => undefined);
    } else {
      await fsp.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => undefined);
    }
    await fsp.rm(rollbackDbPath, { force: true }).catch(() => undefined);
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    await prisma.$connect().catch(() => undefined);

    if (error instanceof AppError) throw error;
    throw new AppError(400, "The backup could not be restored. The previous database was kept.", "RESTORE_FAILED");
  } finally {
    setMaintenanceMode(false);
  }
}
