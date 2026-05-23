import { vi } from "vitest";

// Suppress pino output and avoid pino-pretty worker thread in tests
vi.mock("@repo/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  httpLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Prisma client and error constructors (needed by errorHandler instanceof checks)
vi.mock("@repo/db", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    constructor(
      message: string,
      { code, clientVersion = "0" }: { code: string; clientVersion?: string },
    ) {
      super(message);
      this.name = "PrismaClientKnownRequestError";
      this.code = code;
      this.clientVersion = clientVersion;
    }
  }

  class PrismaClientValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PrismaClientValidationError";
    }
  }

  class PrismaClientInitializationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PrismaClientInitializationError";
    }
  }

  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
    Prisma: {
      PrismaClientKnownRequestError,
      PrismaClientValidationError,
      PrismaClientInitializationError,
    },
  };
});
