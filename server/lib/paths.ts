import path from "node:path";
import fs from "node:fs";

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const DATABASE_PATH = path.join(DATA_DIR, "gift-vault.db");

export function ensureDataDirectories() {
  for (const directory of [DATA_DIR, UPLOAD_DIR, BACKUP_DIR]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function absoluteUploadPath(relativePath: string | null | undefined) {
  if (!relativePath) return null;
  const filename = path.basename(relativePath);
  const fullPath = path.join(UPLOAD_DIR, filename);
  const normalized = path.normalize(fullPath);
  if (!normalized.startsWith(path.normalize(UPLOAD_DIR + path.sep))) return null;
  return normalized;
}
