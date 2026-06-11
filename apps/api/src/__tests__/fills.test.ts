import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { buildMockUser, generateAccessToken, TEST_USER_ID } from "./helpers";

beforeEach(() => {
  vi.resetAllMocks();
});

const MARKET_ID = "9a3e8f00-1111-2222-3333-444455556666";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000999";

function buildMockMarket(overrides: Record<string, unknown> = {}) {
  return {
    id: MARKET_ID,
    marketSlug: "btc-usdc-perp",
    symbol: "BTC",
    imageUrl: null,
    decimals: 2,
    tickSize: "1",
    minQty: 1,
    maxLeverage: 10,
    maintenanceMarginBps: 50,
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function buildMockTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "fill-1",
    price: "50000000000",
    qty: "2",
    createdAt: new Date("2026-06-10T10:00:00.000Z"),
    takerOrder: { side: "LONG" },
    ...overrides,
  };
}

function buildMockUserFill(overrides: Record<string, unknown> = {}) {
  return {
    id: "fill-1",
    takerUserId: TEST_USER_ID,
    makerUserId: OTHER_USER_ID,
    takerOrderId: "taker-order",
    makerOrderId: "maker-order",
    price: "50000000000",
    qty: "2",
    createdAt: new Date("2026-06-10T10:00:00.000Z"),
    market: { symbol: "BTC" },
    takerOrder: { side: "LONG" },
    makerOrder: { side: "SHORT" },
    ...overrides,
  };
}

function authed(method: "get" | "delete", path: string) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
  return request(app)
    [method](path)
    .set("Authorization", `Bearer ${generateAccessToken()}`);
}

// ─── GET /markets/:symbol/trades (public) ────────────────────────────────────

describe("GET /markets/:symbol/trades", () => {
  it("returns the recent trades tape tagged with aggressor side, no auth", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(prisma.fill.findMany).mockResolvedValue([
      buildMockTrade(),
      buildMockTrade({ id: "fill-2", takerOrder: { side: "SHORT" } }),
    ] as any);

    const res = await request(app).get("/markets/BTC/trades");

    expect(res.status).toBe(200);
    expect(res.body.data.symbol).toBe("BTC");
    expect(res.body.data.trades).toHaveLength(2);
    expect(res.body.data.trades[0]).toMatchObject({
      id: "fill-1",
      price: "50000000000",
      takerSide: "LONG",
    });
    expect(res.body.data.trades[1]).toMatchObject({ takerSide: "SHORT" });
  });

  it("defaults the limit to 50 and caps the query at the requested limit", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(prisma.fill.findMany).mockResolvedValue([] as any);

    await request(app).get("/markets/BTC/trades");

    expect(vi.mocked(prisma.fill.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { marketId: MARKET_ID }, take: 50 }),
    );
  });

  it("honors ?limit=", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(prisma.fill.findMany).mockResolvedValue([] as any);

    await request(app).get("/markets/BTC/trades?limit=10");

    expect(vi.mocked(prisma.fill.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it("returns 404 for an unknown market", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const res = await request(app).get("/markets/DOGE/trades");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: "NOT_FOUND" });
  });

  it("rejects an out-of-range limit", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );

    const res = await request(app).get("/markets/BTC/trades?limit=0");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});

// ─── GET /fills (auth) ───────────────────────────────────────────────────────

describe("GET /fills", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/fills");
    expect(res.status).toBe(401);
  });

  it("returns the user's fills with role/side resolved per row", async () => {
    vi.mocked(prisma.fill.findMany).mockResolvedValue([
      buildMockUserFill(), // user is taker (LONG)
      buildMockUserFill({
        id: "fill-2",
        takerUserId: OTHER_USER_ID,
        makerUserId: TEST_USER_ID, // user is maker (SHORT)
      }),
    ] as any);
    vi.mocked(prisma.fill.count).mockResolvedValue(2);

    const res = await authed("get", "/fills");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 100, total: 2 });
    expect(res.body.data.items[0]).toMatchObject({
      role: "TAKER",
      side: "LONG",
      orderId: "taker-order",
      symbol: "BTC",
    });
    expect(res.body.data.items[1]).toMatchObject({
      role: "MAKER",
      side: "SHORT",
      orderId: "maker-order",
    });
  });

  it("queries fills where the user is taker OR maker across all markets", async () => {
    vi.mocked(prisma.fill.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.fill.count).mockResolvedValue(0);

    await authed("get", "/fills?page=2&limit=5");

    expect(vi.mocked(prisma.fill.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ takerUserId: TEST_USER_ID }, { makerUserId: TEST_USER_ID }],
        },
        take: 5,
        skip: 5,
      }),
    );
  });
});

// ─── GET /fills/:symbol (auth) ───────────────────────────────────────────────

describe("GET /fills/:symbol", () => {
  it("scopes fills to the resolved market id", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(prisma.fill.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.fill.count).mockResolvedValue(0);

    await authed("get", "/fills/btc");

    expect(vi.mocked(prisma.market.findUnique)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { symbol: "BTC" } }),
    );
    expect(vi.mocked(prisma.fill.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ marketId: MARKET_ID }),
      }),
    );
  });

  it("returns 404 for an unknown market", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const res = await authed("get", "/fills/DOGE");

    expect(res.status).toBe(404);
  });
});

// ─── GET /orders/:orderId/fills (auth) ───────────────────────────────────────

describe("GET /orders/:orderId/fills", () => {
  const ORDER_ID = "11112222-3333-4444-8555-666677778888";

  function buildMockOrderWithFills(overrides: Record<string, unknown> = {}) {
    return {
      id: ORDER_ID,
      userId: TEST_USER_ID,
      marketId: MARKET_ID,
      type: "LIMIT",
      side: "LONG",
      status: "FILLED",
      price: "50000000000",
      qty: "2",
      slippage: 0,
      filledQty: "2",
      leverage: 5,
      reduceOnly: false,
      createdAt: new Date("2026-06-10T10:00:00.000Z"),
      updatedAt: new Date("2026-06-10T10:00:00.000Z"),
      market: { symbol: "BTC" },
      takerFills: [
        {
          id: "fill-taker",
          price: "50000000000",
          qty: "1",
          createdAt: new Date("2026-06-10T10:00:02.000Z"),
        },
      ],
      makerFills: [
        {
          id: "fill-maker",
          price: "49999000000",
          qty: "1",
          createdAt: new Date("2026-06-10T10:00:01.000Z"),
        },
      ],
      ...overrides,
    };
  }

  it("returns the order's fills time-sorted with role tags", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      buildMockOrderWithFills() as any,
    );

    const res = await authed("get", `/orders/${ORDER_ID}/fills`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ id: "fill-maker", role: "MAKER" });
    expect(res.body.data[1]).toMatchObject({ id: "fill-taker", role: "TAKER" });
  });

  it("returns 404 when the order belongs to another user", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      buildMockOrderWithFills({ userId: OTHER_USER_ID }) as any,
    );

    const res = await authed("get", `/orders/${ORDER_ID}/fills`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: "ORDER_NOT_FOUND" });
  });

  it("returns 400 for a non-uuid order id", async () => {
    const res = await authed("get", "/orders/not-a-uuid/fills");
    expect(res.status).toBe(400);
  });
});
