import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@repo/db";
import { AppError } from "../errors/AppError.js";
import { env } from "../lib/env";

const PRISMA_ERROR_MAP: Record<
  string,
  { status: number; code: string; message: string }
> = {
  P2002: { status: 409, code: "CONFLICT", message: "Resource already exists" },
  P2025: { status: 404, code: "NOT_FOUND", message: "Resource not found" },
  P2003: {
    status: 400,
    code: "INVALID_REFERENCE",
    message: "Invalid reference to a related resource",
  },
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ success: false, code: err.code, message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid request data",
      errors: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_ERROR_MAP[err.code];
    if (mapped) {
      res
        .status(mapped.status)
        .json({ success: false, code: mapped.code, message: mapped.message });
      return;
    }
    res.status(400).json({
      success: false,
      code: "DB_ERROR",
      message: "Database request error",
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      code: "DB_VALIDATION_ERROR",
      message: "Invalid database query",
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    res.status(503).json({
      success: false,
      code: "DB_UNAVAILABLE",
      message: "Database is unavailable",
    });
    return;
  }

  const isDev = env.NODE_ENV === "development";
  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message:
      isDev && err instanceof Error ? err.message : "Internal server error",
    ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
  });
};
