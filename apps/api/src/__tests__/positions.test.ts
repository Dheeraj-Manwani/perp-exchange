import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { sendToEngineWithPubSubResponse } from "../lib/engine-client";
import { buildMockUser, generateAccessToken, TEST_USER_ID } from "./helpers";

beforeEach(() => {
  vi.resetAllMocks();
});

function authed(method: "get", path: string) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
  return request(app)
    [method](path)
    .set("Authorization", `Bearer ${generateAccessToken()}`);
}

function buildPositionView(overrides: Record<string, unknown> = {}) {
  return {
    positionId: "pos-1",
    market: "BTC",
    side: "LONG",
    qty: 2,
    margin: "1000",
    leverage: 10,
    averagePrice: "6700000",
    liquidationPrice: "6000000",
    markPrice: "6724000",
    unrealisedPnl: "4800",
    ...overrides,
  };
}

// ─── GET /positions ──────────────────────────────────────────────────────────

describe("GET /positions", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/positions");
    expect(res.status).toBe(401);
  });

  it("returns the user's open positions from the engine", async () => {
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: { positions: [buildPositionView()] },
    } as any);

    const res = await authed("get", "/positions");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      market: "BTC",
      markPrice: "6724000",
      unrealisedPnl: "4800",
    });
    expect(vi.mocked(sendToEngineWithPubSubResponse)).toHaveBeenCalledWith(
      "get_positions",
      {},
      TEST_USER_ID,
    );
  });

  it("returns 503 when the engine errors", async () => {
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: false,
      error: "engine down",
    } as any);

    const res = await authed("get", "/positions");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });
});

// ─── GET /positions/:symbol ──────────────────────────────────────────────────

describe("GET /positions/:symbol", () => {
  it("returns a single open position", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue({
      symbol: "BTC",
    } as any);
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: { position: buildPositionView() },
    } as any);

    const res = await authed("get", "/positions/btc");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ market: "BTC", side: "LONG" });
    // symbol normalised + market resolved before hitting the engine
    expect(vi.mocked(sendToEngineWithPubSubResponse)).toHaveBeenCalledWith(
      "get_position",
      { symbol: "BTC" },
      TEST_USER_ID,
    );
  });

  it("returns 404 when the market is unknown", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null);

    const res = await authed("get", "/positions/DOGE");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(vi.mocked(sendToEngineWithPubSubResponse)).not.toHaveBeenCalled();
  });

  it("returns 404 when there is no open position for the market", async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue({
      symbol: "BTC",
    } as any);
    vi.mocked(sendToEngineWithPubSubResponse).mockResolvedValue({
      ok: true,
      data: { position: null },
    } as any);

    const res = await authed("get", "/positions/BTC");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      code: "POSITION_NOT_FOUND",
    });
  });
});

// ─── GET /positions/history ──────────────────────────────────────────────────

describe("GET /positions/history", () => {
  it("returns paginated REALISED_PNL ledger rows", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: "pnl-1",
        amount: "1200",
        balanceAfter: "11200",
        referenceId: "pos-1",
        createdAt: new Date("2026-06-12T10:00:00.000Z"),
        market: { symbol: "BTC" },
      },
    ] as any);
    vi.mocked(prisma.transaction.count).mockResolvedValue(1);

    const res = await authed("get", "/positions/history");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 100, total: 1 });
    expect(res.body.data.items[0]).toMatchObject({
      id: "pnl-1",
      symbol: "BTC",
      realisedPnl: "1200",
    });
    // Always scoped to REALISED_PNL, and reads the DB — never the engine.
    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER_ID, type: "REALISED_PNL" },
      }),
    );
    expect(vi.mocked(sendToEngineWithPubSubResponse)).not.toHaveBeenCalled();
  });

  it("scopes by ?symbol= via the market relation with pagination", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);

    await authed("get", "/positions/history?symbol=eth&page=2&limit=5");

    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: TEST_USER_ID,
          type: "REALISED_PNL",
          market: { symbol: "ETH" },
        },
        take: 5,
        skip: 5,
      }),
    );
  });
});
