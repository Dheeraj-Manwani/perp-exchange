import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { sendToEngineWithPubSubResponse } from "../lib/engine-client";
import { getNextFundingTime } from "../service/market.service";

beforeEach(() => {
  vi.resetAllMocks();
});

const MARKET_ID = "9a3e8f00-1111-2222-3333-444455556666";

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

function buildMockFundingRate(overrides: Record<string, unknown> = {}) {
  return {
    id: "ffff8f00-1111-2222-3333-444455556666",
    marketId: MARKET_ID,
    period: "2026-06-10T08:00:00.000Z",
    rateBps: "12",
    markPrice: "6723450",
    settledAt: new Date("2026-06-10T08:00:00.000Z"),
    createdAt: new Date("2026-06-10T08:00:01.000Z"),
    ...overrides,
  };
}

// ─── GET /markets ────────────────────────────────────────────────────────────

describe("GET /markets", () => {
  it("returns active markets without requiring auth", async () => {
    vi.mocked(prisma.market.findMany).mockResolvedValue([
      buildMockMarket(),
    ] as any);

    const res = await request(app).get("/markets");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      symbol: "BTC",
      tickSize: "1",
      minQty: 1,
      maxLeverage: 10,
      maintenanceMarginBps: 50,
    });
    expect(vi.mocked(prisma.market.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });
});

// ─── GET /markets/:symbol ────────────────────────────────────────────────────

describe("GET /markets/:symbol", () => {
  it("returns the market detail", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );

    const res = await request(app).get("/markets/BTC");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ symbol: "BTC", decimals: 2 });
  });

  it("normalizes a lowercase symbol", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );

    const res = await request(app).get("/markets/btc");

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.market.findUnique)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { symbol: "BTC" } }),
    );
  });

  it("returns 404 for an unknown market", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const res = await request(app).get("/markets/DOGE");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: "NOT_FOUND" });
  });
});

// ─── GET /markets/:symbol/index-price ────────────────────────────────────────

describe("GET /markets/:symbol/index-price", () => {
  it("returns the index price from the engine loopback", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: {
        symbol: "BTC",
        indexPrice: "6723450",
        updatedAt: 1765000000000,
      },
    } as any);

    const res = await request(app).get("/markets/BTC/index-price");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      symbol: "BTC",
      indexPrice: "6723450",
      updatedAt: 1765000000000,
    });
    expect(vi.mocked(sendToEngineWithPubSubResponse)).toHaveBeenCalledWith(
      "get_index_price",
      { symbol: "BTC" },
      "system",
    );
  });

  it("returns 503 when the engine has no price yet", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: { symbol: "BTC", indexPrice: "0", updatedAt: 0 },
    } as any);

    const res = await request(app).get("/markets/BTC/index-price");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("returns 404 for an unknown market", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const res = await request(app).get("/markets/DOGE/index-price");

    expect(res.status).toBe(404);
  });
});

// ─── GET /markets/:symbol/mark-price ─────────────────────────────────────────

describe("GET /markets/:symbol/mark-price", () => {
  it("returns the mark + index price from the engine (public, no auth)", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: {
        symbol: "BTC",
        markPrice: "6724000",
        indexPrice: "6723450",
        updatedAt: 1765000000000,
      },
    } as any);

    const res = await request(app).get("/markets/BTC/mark-price");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      symbol: "BTC",
      markPrice: "6724000",
      indexPrice: "6723450",
      updatedAt: 1765000000000,
    });
    expect(vi.mocked(sendToEngineWithPubSubResponse)).toHaveBeenCalledWith(
      "get_mark_price",
      { symbol: "BTC" },
      "system",
    );
  });

  it("returns 503 when the engine has no price yet", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: { symbol: "BTC", markPrice: "0", indexPrice: "0", updatedAt: 0 },
    } as any);

    const res = await request(app).get("/markets/BTC/mark-price");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("returns 404 for an unknown market", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const res = await request(app).get("/markets/DOGE/mark-price");

    expect(res.status).toBe(404);
  });
});

// ─── GET /markets/:symbol/funding-rate ───────────────────────────────────────

describe("GET /markets/:symbol/funding-rate", () => {
  it("returns the latest settled rate with the next settlement time", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(prisma.fundingRate.findFirst).mockResolvedValue(
      buildMockFundingRate() as any,
    );

    const res = await request(app).get("/markets/BTC/funding-rate");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      symbol: "BTC",
      rateBps: "12",
      markPrice: "6723450",
      intervalSeconds: 8 * 60 * 60,
    });
    expect(new Date(res.body.data.nextFundingTime).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("returns zero-rate defaults when no settlement has happened yet", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(prisma.fundingRate.findFirst).mockResolvedValue(null);

    const res = await request(app).get("/markets/BTC/funding-rate");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      rateBps: "0",
      markPrice: null,
      settledAt: null,
    });
  });
});

// ─── GET /markets/:symbol/funding-rate/history ───────────────────────────────

describe("GET /markets/:symbol/funding-rate/history", () => {
  it("returns paginated history with total count", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(prisma.fundingRate.findMany).mockResolvedValue([
      buildMockFundingRate(),
    ] as any);
    vi.mocked(prisma.fundingRate.count).mockResolvedValue(7);

    const res = await request(app).get(
      "/markets/BTC/funding-rate/history?limit=5&page=2",
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      symbol: "BTC",
      page: 2,
      limit: 5,
      total: 7,
    });
    expect(res.body.data.items[0]).toMatchObject({
      period: "2026-06-10T08:00:00.000Z",
      rateBps: "12",
    });
    expect(vi.mocked(prisma.fundingRate.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 5 }),
    );
  });

  it("rejects an out-of-range limit", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );

    const res = await request(app).get(
      "/markets/BTC/funding-rate/history?limit=0",
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});

// ─── GET /server/time ────────────────────────────────────────────────────────

describe("GET /server/time", () => {
  it("returns the current server time", async () => {
    const before = Date.now();
    const res = await request(app).get("/server/time");
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.serverTime).toBeGreaterThanOrEqual(before);
    expect(res.body.data.serverTime).toBeLessThanOrEqual(after);
  });
});

// ─── getNextFundingTime ──────────────────────────────────────────────────────

describe("getNextFundingTime", () => {
  it.each([
    ["2026-06-10T03:15:00.000Z", "2026-06-10T08:00:00.000Z"],
    ["2026-06-10T08:00:00.000Z", "2026-06-10T16:00:00.000Z"],
    ["2026-06-10T15:59:59.999Z", "2026-06-10T16:00:00.000Z"],
    ["2026-06-10T22:30:00.000Z", "2026-06-11T00:00:00.000Z"],
  ])("from %s the next boundary is %s", (now, expected) => {
    expect(getNextFundingTime(new Date(now)).toISOString()).toBe(expected);
  });
});

// ─── GET /markets/:symbol/orderbook ──────────────────────────────────────────

describe("GET /markets/:symbol/orderbook", () => {
  it("returns bids/asks + lastUpdateId from the engine (public, no auth)", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: {
        symbol: "BTC",
        bids: [["6723400", "5"]],
        asks: [["6723500", "3"]],
        lastUpdateId: 42,
      },
    } as any);

    const res = await request(app).get("/markets/BTC/orderbook");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      symbol: "BTC",
      bids: [["6723400", "5"]],
      asks: [["6723500", "3"]],
      lastUpdateId: 42,
    });
    expect(vi.mocked(sendToEngineWithPubSubResponse)).toHaveBeenCalledWith(
      "get_orderbook",
      { symbol: "BTC", depth: 20 },
      "system",
    );
  });

  it("passes a custom ?depth through to the engine", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: { symbol: "BTC", bids: [], asks: [], lastUpdateId: 1 },
    } as any);

    const res = await request(app).get("/markets/BTC/orderbook?depth=50");

    expect(res.status).toBe(200);
    expect(vi.mocked(sendToEngineWithPubSubResponse)).toHaveBeenCalledWith(
      "get_orderbook",
      { symbol: "BTC", depth: 50 },
      "system",
    );
  });

  it("rejects a depth above the 500 cap with 400", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket() as any,
    );

    const res = await request(app).get("/markets/BTC/orderbook?depth=600");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 503 when the engine query fails", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(
      buildMockMarket({ symbol: "ETH" }) as any,
    );
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: false,
      error: "engine down",
    } as any);

    const res = await request(app).get("/markets/ETH/orderbook");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("returns 404 for an unknown market", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const res = await request(app).get("/markets/DOGE/orderbook");

    expect(res.status).toBe(404);
  });
});
