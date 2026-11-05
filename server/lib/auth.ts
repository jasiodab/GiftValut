import crypto from "node:crypto";
import { prisma } from "../lib/prisma";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const key = Buffer.from(parts[2], "hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(key, derived);
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  return token;
}

type CachedUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
};

type CachedSession = {
  user: CachedUser;
  expiresAt: number;
  revokedAt: number | null;
  lastDbSeenAt: number;
  cachedAt: number;
};

// Short-lived, bounded in-memory cache. It only stores non-sensitive session/user
// metadata and is invalidated on logout, password change and session revocation.
const SESSION_CACHE_TTL_MS = 15_000;
const SESSION_CACHE_MAX_ENTRIES = 256;
const LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const sessionCache = new Map<string, CachedSession>();

function evictOldestCacheEntry() {
  if (sessionCache.size < SESSION_CACHE_MAX_ENTRIES) return;
  const oldestKey = sessionCache.keys().next().value;
  if (oldestKey) sessionCache.delete(oldestKey);
}

function invalidateCachedSession(tokenHash: string) {
  sessionCache.delete(tokenHash);
}

function invalidateCachedSessionsForUser(userId: string) {
  for (const [key, value] of sessionCache) {
    if (value.user.id === userId) sessionCache.delete(key);
  }
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = Date.now();

  const cached = sessionCache.get(tokenHash);
  if (cached && now - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    if (cached.expiresAt < now || cached.revokedAt !== null || cached.user.status !== "ACTIVE") {
      sessionCache.delete(tokenHash);
      return null;
    }

    if (now - cached.lastDbSeenAt >= LAST_SEEN_UPDATE_INTERVAL_MS) {
      cached.lastDbSeenAt = now;
      void prisma.session
        .updateMany({
          where: { tokenHash, revokedAt: null },
          data: { lastSeenAt: new Date(now) }
        })
        .catch(() => undefined);
    }

    return cached.user;
  }

  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session) return null;
  if (session.revokedAt) {
    sessionCache.delete(tokenHash);
    return null;
  }
  if (session.expiresAt < new Date()) {
    sessionCache.delete(tokenHash);
    return null;
  }
  if (session.user.status !== "ACTIVE") {
    sessionCache.delete(tokenHash);
    return null;
  }

  const lastSeenAt = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
  let nextLastDbSeenAt = lastSeenAt;
  if (now - lastSeenAt >= LAST_SEEN_UPDATE_INTERVAL_MS) {
    nextLastDbSeenAt = now;
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } })
      .catch(() => undefined);
  }

  const user: CachedUser = {
    id: session.user.id,
    username: session.user.username,
    email: session.user.email,
    role: session.user.role,
    status: session.user.status
  };

  evictOldestCacheEntry();
  sessionCache.set(tokenHash, {
    user,
    expiresAt: new Date(session.expiresAt).getTime(),
    revokedAt: null,
    lastDbSeenAt: nextLastDbSeenAt,
    cachedAt: now
  });

  return user;
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.session.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
  invalidateCachedSession(tokenHash);
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  invalidateCachedSessionsForUser(userId);
}

let lastExpiredSessionCleanupAt = 0;
const EXPIRED_SESSION_CLEANUP_INTERVAL_MS = 4 * 60 * 60 * 1000;

export async function cleanupExpiredSessions(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastExpiredSessionCleanupAt < EXPIRED_SESSION_CLEANUP_INTERVAL_MS) return;

  lastExpiredSessionCleanupAt = now;
  try {
    await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date(now) } }
    });
  } catch (error) {
    console.warn("Expired session cleanup failed.", error);
  }
}
