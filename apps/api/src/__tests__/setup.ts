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
      balance: {
        create: vi.fn(),
      },
      market: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      fundingRate: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
    },
    Prisma: {
      PrismaClientKnownRequestError,
      PrismaClientValidationError,
      PrismaClientInitializationError,
    },
  };
});

// Mock Redis clients — tests must not require a live Redis.
// market.service reads the index-price cache via publisher.hGet.
vi.mock("../lib/redis-client", () => ({
  publisher: { hGet: vi.fn() },
  subscriber: {},
  pubSubSubscriber: {},
  connectRedis: vi.fn(),
}));

// Mock engine client — tests must not require a live Redis or engine process.
// Individual tests can override sendToEngine via vi.mocked(sendToEngine).mockResolvedValue(...)
vi.mock("../lib/engine-client", () => ({
  sendToEngine: vi.fn().mockResolvedValue({ correlationId: "test-cid", ok: true, data: undefined }),
  listenToEngine: vi.fn().mockResolvedValue(undefined),
  pendingResponses: new Map(),
}));
