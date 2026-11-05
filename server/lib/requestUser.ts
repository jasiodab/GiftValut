import type { Request } from "express";
import { AppError } from "./errors";

export function requestUserId(req: Request): string {
  const userId = (req as any).user?.id;
  if (typeof userId !== "string" || !userId) {
    throw new AppError(401, "Authentication required.", "UNAUTHORIZED");
  }
  return userId;
}
