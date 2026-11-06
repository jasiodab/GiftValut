import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, message: string, code = "APP_ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof Error && error.name === "MulterError") {
    const code = (error as Error & { code?: string }).code;
    return res.status(400).json({
      error: {
        code: "UPLOAD_ERROR",
        message:
          code === "LIMIT_FILE_SIZE"
            ? "The uploaded file is too large."
            : "The file upload could not be processed."
      }
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the highlighted fields.",
        details: error.flatten()
      }
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? "value";
      const field = Array.isArray(target) ? target.join(", ") : target;
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `A record with this ${field} already exists.`
        }
      });
    }
    if (error.code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "The requested record was not found." }
      });
    }
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }

  if (error instanceof Error) {
    console.error(error);
    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong on the local server."
      }
    });
  }

  console.error("Unknown error", error);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." }
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `No API route matches ${req.method} ${req.path}.`
    }
  });
}
