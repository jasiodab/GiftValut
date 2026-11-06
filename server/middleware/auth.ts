import type { Request, Response, NextFunction } from "express";
import { cleanupExpiredSessions, getSessionUser } from "../lib/auth";

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    // Avoid SQLite session lookups for static assets and health checks.
    // Use originalUrl because req.path is relative to the current router mount.
    const requestPath = (req.originalUrl || req.url || "").split("?")[0];
    if ((!requestPath.startsWith("/api") && !requestPath.startsWith("/uploads/")) || requestPath === "/api/health") {
      (req as any).user = null;
      return next();
    }

    let token: any = req.headers["x-session-token"];
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.match(/(?:^|;\s*)gv_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
    const user = await getSessionUser(typeof token === "string" ? token : undefined);
    (req as any).user = user;
    void cleanupExpiredSessions();
    next();
  } catch (error) {
    // Express 4 does not catch rejected async middleware, which would crash the
    // process. Forward the failure to the central error handler instead.
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== "OWNER") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Owner access required." } });
  }
  next();
}
