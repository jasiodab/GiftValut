import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { UPLOAD_DIR, absoluteUploadPath } from "../lib/paths";
import { safeFetch } from "./safeFetch";
import { prisma } from "../lib/prisma";

type ImageKind = { extension: string; mimeType: string };

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export function detectImage(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: "png", mimeType: "image/png" };
  }
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") {
    return { extension: "gif", mimeType: "image/gif" };
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }
  const brand = buffer.subarray(4, 12).toString("ascii");
  if (brand.includes("ftypavi")) {
    return { extension: "avif", mimeType: "image/avif" };
  }

  return null;
}

export async function saveImageBuffer(
  buffer: Buffer,
  userId: string,
  declaredMimeType?: string
): Promise<{ path: string; mimeType: string }> {
  if (buffer.length === 0) {
    throw new Error("The image file is empty.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("The image is larger than the 8 MB limit.");
  }

  const detected = detectImage(buffer);
  if (!detected) {
    throw new Error("The file is not a supported image (JPEG, PNG, WebP, GIF or AVIF).");
  }
  if (declaredMimeType && !declaredMimeType.startsWith("image/") && declaredMimeType !== "application/octet-stream") {
    throw new Error("The file does not look like an image.");
  }

  const filename = `${randomUUID()}.${detected.extension}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(`${UPLOAD_DIR}/${filename}`, buffer, { flag: "wx" });
  try {
    await prisma.upload.create({ data: { filename, userId } });
  } catch (error) {
    await fs.unlink(`${UPLOAD_DIR}/${filename}`).catch(() => undefined);
    throw error;
  }
  return { path: `/uploads/${filename}`, mimeType: detected.mimeType };
}

export async function downloadProductImage(
  imageUrl: string | null | undefined,
  pageUrl: string,
  userId: string
): Promise<{ path: string; sourceUrl: string } | null> {
  if (!imageUrl) return null;

  let absoluteUrl: URL;
  try {
    absoluteUrl = new URL(imageUrl, pageUrl);
  } catch {
    return null;
  }
  if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") return null;

  try {
    const response = await safeFetch(absoluteUrl, {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 15000,
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.5" }
    });

    if (response.status < 200 || response.status >= 300) return null;
    const contentType = response.contentType.split(";")[0].trim().toLowerCase();
    if (contentType && !ALLOWED_MIME_TYPES.has(contentType) && contentType !== "application/octet-stream") {
      return null;
    }

    const saved = await saveImageBuffer(response.body, userId, contentType);
    return { path: saved.path, sourceUrl: absoluteUrl.toString() };
  } catch {
    return null;
  }
}

export async function deleteLocalImage(relativePath: string | null | undefined): Promise<void> {
  const absolutePath = absoluteUploadPath(relativePath);
  if (!absolutePath) return;
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("Could not delete image", absolutePath, error);
    }
  }
}

export async function uploadsSize(filenames?: string[]): Promise<number> {
  try {
    const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
    let total = 0;
    const wanted = filenames ? new Set(filenames) : null;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (wanted && !wanted.has(entry.name)) continue;
      const stats = await fs.stat(`${UPLOAD_DIR}/${entry.name}`);
      total += stats.size;
    }
    return total;
  } catch {
    return 0;
  }
}
