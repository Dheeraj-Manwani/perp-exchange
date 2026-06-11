import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { buildMockUser, generateAccessToken, TEST_USER_ID } from "./helpers";
import { TAKER_FEE_RATE, MAKER_FEE_RATE } from "@repo/schema";

beforeEach(() => {
  vi.resetAllMocks();
});

function authed(method: "get" | "delete", path: string) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
  return request(app)
    [method](path)
    .set("Authorization", `Bearer ${generateAccessToken()}`);
}

// ─── GET /account/balances ───────────────────────────────────────────────────

describe("GET /account/balances", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/account/balances");
    expect(res.status).toBe(401);
  });

  it("returns the user's per-asset balances", async () => {
    vi.mocked(prisma.balance.findMany).mockResolvedValue([
      {
        asset: "USD",
        availableBalance: "1000",
        lockedBalance: "200",
        updatedAt: new Date("2026-06-10T10:00:00.000Z"),
      },
    ] as any);

    const res = await authed("get", "/account/balances");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        asset: "USD",
        available: "1000",
        locked: "200",
        updatedAt: "2026-06-10T10:00:00.000Z",
      },
    ]);
    expect(vi.mocked(prisma.balance.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: TEST_USER_ID } }),
    );
  });
});

// ─── GET /account/transactions ───────────────────────────────────────────────

describe("GET /account/transactions", () => {
  function buildMockTxn(overrides: Record<string, unknown> = {}) {
    return {
      id: "txn-1",
      type: "TRADE_FEE",
      asset: "USD",
      amount: "30",
      balanceAfter: "970",
      referenceId: "order-1",
      createdAt: new Date("2026-06-10T10:00:00.000Z"),
      market: { symbol: "BTC" },
      ...overrides,
    };
  }

  it("returns a paginated ledger with market symbol resolved", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      buildMockTxn(),
      buildMockTxn({ id: "txn-2", market: null, referenceId: null }),
    ] as any);
    vi.mocked(prisma.transaction.count).mockResolvedValue(2);

    const res = await authed("get", "/account/transactions");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 100, total: 2 });
    expect(res.body.data.items[0]).toMatchObject({
      id: "txn-1",
      type: "TRADE_FEE",
      symbol: "BTC",
      referenceId: "order-1",
    });
    expect(res.body.data.items[1]).toMatchObject({
      symbol: null,
      referenceId: null,
    });
  });

  it("applies the ?type= filter and pagination to the query", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);

    await authed("get", "/account/transactions?type=FUNDING&page=2&limit=5");

    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER_ID, type: "FUNDING" },
        take: 5,
        skip: 5,
      }),
    );
  });

  it("rejects an unknown ?type=", async () => {
    const res = await authed("get", "/account/transactions?type=BOGUS");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});

// ─── GET /account/funding-payments ───────────────────────────────────────────

describe("GET /account/funding-payments", () => {
  it("returns FUNDING rows with period + market context", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: "fund-1",
        type: "FUNDING",
        asset: "USD",
        amount: "-15",
        balanceAfter: "985",
        referenceId: "2026-06-10T08:00:00.000Z",
        createdAt: new Date("2026-06-10T08:00:00.000Z"),
        market: { symbol: "BTC" },
      },
    ] as any);
    vi.mocked(prisma.transaction.count).mockResolvedValue(1);

    const res = await authed("get", "/account/funding-payments");

    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toMatchObject({
      id: "fund-1",
      symbol: "BTC",
      period: "2026-06-10T08:00:00.000Z",
      amount: "-15",
    });
    // Always scoped to FUNDING type
    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER_ID, type: "FUNDING" },
      }),
    );
  });

  it("scopes by ?symbol= via the market relation", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.transaction.count).mockResolvedValue(0);

    await authed("get", "/account/funding-payments?symbol=btc");

    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: TEST_USER_ID,
          type: "FUNDING",
          market: { symbol: "BTC" },
        },
      }),
    );
  });
});

// ─── GET /account/liquidations ───────────────────────────────────────────────

describe("GET /account/liquidations", () => {
  it("returns LIQUIDATED orders joined with their fills", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: "liq-order-1",
        type: "MARKET",
        side: "LONG",
        status: "LIQUIDATED",
        price: "49000000000",
        qty: "2",
        filledQty: "2",
        leverage: 10,
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        updatedAt: new Date("2026-06-10T10:00:01.000Z"),
        market: { symbol: "BTC" },
        takerFills: [
          {
            id: "fill-1",
            price: "49000000000",
            qty: "2",
            createdAt: new Date("2026-06-10T10:00:01.000Z"),
          },
        ],
      },
    ] as any);
    vi.mocked(prisma.order.count).mockResolvedValue(1);

    const res = await authed("get", "/account/liquidations");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 1, limit: 100, total: 1 });
    expect(res.body.data.items[0]).toMatchObject({
      orderId: "liq-order-1",
      symbol: "BTC",
      status: "LIQUIDATED",
    });
    expect(res.body.data.items[0].fills).toHaveLength(1);
    expect(vi.mocked(prisma.order.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER_ID, status: "LIQUIDATED" },
      }),
    );
  });

  it("scopes by ?symbol=", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.order.count).mockResolvedValue(0);

    await authed("get", "/account/liquidations?symbol=eth");

    expect(vi.mocked(prisma.order.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: TEST_USER_ID,
          status: "LIQUIDATED",
          market: { symbol: "ETH" },
        },
      }),
    );
  });
});

// ─── GET /account/fees ───────────────────────────────────────────────────────

describe("GET /account/fees", () => {
  it("returns the static maker/taker fee schedule", async () => {
    const res = await authed("get", "/account/fees");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      takerFeeRate: TAKER_FEE_RATE,
      makerFeeRate: MAKER_FEE_RATE,
      takerFeeBps: 6,
      makerFeeBps: 2,
    });
  });
});
