import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { productsRouter } from "./routes/products";
import { categoriesRouter, tagsRouter } from "./routes/categories";
import { dashboardRouter } from "./routes/dashboard";
import { extractRouter } from "./routes/extract";
import { settingsRouter } from "./routes/settings";
import { uploadsRouter } from "./routes/uploads";
import { authRouter } from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import { requireAuth } from "./middleware/auth";
import { createRateLimiter, getClientIp, userOrIpKey } from "./middleware/rateLimit";
import { prisma } from "./lib/prisma";
import { ensureDataDirectories, ROOT_DIR, UPLOAD_DIR, absoluteUploadPath } from "./lib/paths";
import { AppError, asyncHandler, errorHandler, notFoundHandler } from "./lib/errors";

export function createApp() {
  ensureDataDirectories();
  const app = express();

  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|frog03-31825\.wykr\.es)(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Origin not allowed"));
        }
      }
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(authMiddleware);

  const generalApiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 240,
    keyPrefix: "api",
    keyGenerator: userOrIpKey,
    skip: (req) =>
      req.path === "/health" ||
      req.path === "/auth/login" ||
      req.path === "/auth/bootstrap" ||
      req.path === "/extract"
  });

  const loginLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 10,
    keyPrefix: "login",
    keyGenerator: (req) => getClientIp(req)
  });

  const bootstrapLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyPrefix: "bootstrap",
    keyGenerator: (req) => getClientIp(req)
  });

  const extractLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: "extract",
    keyGenerator: userOrIpKey
  });

  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/bootstrap", bootstrapLimiter);
  app.use("/api/extract", extractLimiter);
  app.use("/api", generalApiLimiter);
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth") || req.path === "/health") return next();
    return requireAuth(req, res, next);
  });

  app.get("/uploads/:filename", requireAuth, asyncHandler(async (req, res) => {
    const userId = (req as any).user.id as string;
    const filename = path.basename(req.params.filename);
    const upload = await prisma.upload.findFirst({ where: { filename, userId } });
    const imagePath = upload ? absoluteUploadPath(filename) : null;
    if (!imagePath || !fs.existsSync(imagePath)) throw new AppError(404, "Image not found.", "NOT_FOUND");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(imagePath);
  }));

  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ok",
        database: "connected",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    })
  );

  app.get(
    "/api/meta",
    asyncHandler(async (req, res) => {
      const userId = (req as any).user.id as string;
      const [productCount, settings] = await Promise.all([
        prisma.product.count({ where: { userId } }),
        prisma.settings.findUnique({ where: { userId }, select: { lastBackupAt: true } })
      ]);
      res.json({
        productCount,
        status: "ok",
        database: "connected",
        frogMode: process.env.FROG_MODE === "true",
        lastBackupAt: settings?.lastBackupAt ?? null
      });
    })
  );

  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/tags", tagsRouter);
  app.use("/api/extract", extractRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", notFoundHandler);

  const clientDist = path.join(ROOT_DIR, "client", "dist");
  if (fs.existsSync(clientDist)) {
    // Hashed build assets never change, so they can be cached forever.
    app.use(
      "/assets",
      express.static(path.join(clientDist, "assets"), { maxAge: "1y", immutable: true })
    );
    app.use(
      express.static(clientDist, {
        maxAge: "1h",
        setHeaders: (res, filePath) => {
          const basename = path.basename(filePath);
          if (basename === "index.html" || basename === "sw.js" || basename === "manifest.webmanifest") {
            res.setHeader("Cache-Control", "no-cache");
          }
        }
      })
    );
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/uploads/")) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

