import type { Request, Response, NextFunction } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const MAX_BUCKETS = 10_000;

export function getClientIp(req: Request): string {
  const remote = req.socket?.remoteAddress || "";
  const isLocalProxy =
    remote === "127.0.0.1" ||
    remote === "::1" ||
    remote === "::ffff:127.0.0.1";

  if (isLocalProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim();
    }
  }

  return remote || "unknown";
}

function evictExpiredBuckets(store: Map<string, Bucket>, now: number) {
  if (store.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
    if (store.size <= MAX_BUCKETS) return;
  }
  // If still too large, remove oldest entries.
  while (store.size > MAX_BUCKETS) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, Bucket>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    if (options.skip?.(req)) return next();

    const now = Date.now();
    evictExpiredBuckets(store, now);

    const identity = options.keyGenerator ? options.keyGenerator(req) : getClientIp(req);
    const key = `${options.keyPrefix}:${identity}`;
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (bucket.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later."
        }
      });
    }

    bucket.count += 1;
    return next();
  };
}

export function userOrIpKey(req: Request): string {
  const user = (req as any).user;
  if (user?.id) return `user:${user.id}`;
  return `ip:${getClientIp(req)}`;
}
