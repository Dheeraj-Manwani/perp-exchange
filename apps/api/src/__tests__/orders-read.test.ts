import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { buildMockUser, generateAccessToken, TEST_USER_ID } from "./helpers";
import { sendToEngine } from "../lib/engine-client";

beforeEach(() => {
  vi.resetAllMocks();
});

const ORDER_ID = "11112222-3333-4444-8555-666677778888";

function buildMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    userId: TEST_USER_ID,
    marketId: "9a3e8f00-1111-2222-3333-444455556666",
    type: "LIMIT",
    side: "LONG",
    status: "OPEN",
    price: "50000000000",
    qty: "2",
    slippage: 0,
    filledQty: "0",
    leverage: 5,
    reduceOnly: false,
    createdAt: new Date("2026-06-10T10:00:00.000Z"),
    updatedAt: new Date("2026-06-10T10:00:00.000Z"),
    market: { symbol: "BTC-PERP" },
    ...overrides,
  };
}

function authed(method: "get" | "delete", path: string) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
  return request(app)
    [method](path)
    .set("Authorization", `Bearer ${generateAccessToken()}`);
}

// ─── Auth guard ──────────────────────────────────────────────────────────────

describe("GET /orders — auth guard", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });
});

// ─── GET /orders ─────────────────────────────────────────────────────────────

describe("GET /orders", () => {
  it("returns the user's open orders shaped as DTOs", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      buildMockOrder(),
    ] as any);

    const res = await authed("get", "/orders");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      orderId: ORDER_ID,
      symbol: "BTC-PERP",
      status: "OPEN",
      side: "LONG",
      leverage: 5,
    });
    // never leaks the raw userId
    expect(res.body.data[0]).not.toHaveProperty("userId");
  });

  it("queries only OPEN and PARTIALLY_FILLED statuses for the auth user", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([] as any);

    await authed("get", "/orders");

    expect(vi.mocked(prisma.order.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: TEST_USER_ID,
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
        }),
      }),
    );
  });

  it("applies the ?symbol= filter (normalized to uppercase)", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([] as any);

    await authed("get", "/orders?symbol=btc-perp");

    expect(vi.mocked(prisma.order.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ market: { symbol: "BTC-PERP" } }),
      }),
    );
  });
});

// ─── GET /orders/history ─────────────────────────────────────────────────────

describe("GET /orders/history", () => {
  it("returns paginated history with total and echoes page/limit", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      buildMockOrder({ status: "FILLED" }),
    ] as any);
    vi.mocked(prisma.order.count).mockResolvedValue(17);

    const res = await authed("get", "/orders/history?limit=5&page=2");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ page: 2, limit: 5, total: 17 });
    expect(res.body.data.items[0]).toMatchObject({ status: "FILLED" });
    expect(vi.mocked(prisma.order.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 5 }),
    );
  });

  it("passes the ?status= filter through to the query", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.order.count).mockResolvedValue(0);

    await authed("get", "/orders/history?status=CANCELLED");

    expect(vi.mocked(prisma.order.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });

  it("rejects an invalid status enum", async () => {
    const res = await authed("get", "/orders/history?status=bogus");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("rejects an out-of-range limit", async () => {
    const res = await authed("get", "/orders/history?limit=99999");
    expect(res.status).toBe(400);
  });
});

// ─── GET /orders/:orderId ────────────────────────────────────────────────────

describe("GET /orders/:orderId", () => {
  it("returns the order with merged taker+maker fills sorted by time", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      buildMockOrder({
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
      }) as any,
    );

    const res = await authed("get", `/orders/${ORDER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(ORDER_ID);
    expect(res.body.data.fills).toHaveLength(2);
    // maker fill is earlier, so it sorts first; roles are tagged
    expect(res.body.data.fills[0]).toMatchObject({
      id: "fill-maker",
      role: "MAKER",
    });
    expect(res.body.data.fills[1]).toMatchObject({
      id: "fill-taker",
      role: "TAKER",
    });
  });

  it("returns 404 for a well-formed id that doesn't exist", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const res = await authed("get", `/orders/${ORDER_ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: "ORDER_NOT_FOUND" });
  });

  it("returns 404 (not 403) when the order belongs to another user", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(
      buildMockOrder({
        userId: "00000000-0000-0000-0000-000000000999",
        takerFills: [],
        makerFills: [],
      }) as any,
    );

    const res = await authed("get", `/orders/${ORDER_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-uuid order id", async () => {
    const res = await authed("get", "/orders/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});

// ─── DELETE /orders (cancel all) ─────────────────────────────────────────────

describe("DELETE /orders", () => {
  it("fans out one cancel_order per open order and reports per-order results", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      buildMockOrder({ id: "order-a" }),
      buildMockOrder({ id: "order-b", side: "SHORT" }),
    ] as any);
    vi.mocked(sendToEngine).mockResolvedValue({
      ok: true,
      data: { orderId: "x", releasedMargin: "1000" },
    } as any);

    const res = await authed("delete", "/orders");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 2, cancelled: 2 });
    expect(res.body.data.orders).toHaveLength(2);
    expect(vi.mocked(sendToEngine)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendToEngine)).toHaveBeenCalledWith(
      "cancel_order",
      { orderId: "order-b", symbol: "BTC-PERP", side: "SHORT" },
      TEST_USER_ID,
    );
  });

  it("reports a failed cancel without aborting the rest", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      buildMockOrder({ id: "order-a" }),
      buildMockOrder({ id: "order-b" }),
    ] as any);
    vi.mocked(sendToEngine)
      .mockResolvedValueOnce({ ok: true, data: { releasedMargin: "1" } } as any)
      .mockResolvedValueOnce({ ok: false, error: "order_not_found" } as any);

    const res = await authed("delete", "/orders");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 2, cancelled: 1 });
    const failed = res.body.data.orders.find(
      (o: { status: string }) => o.status === "FAILED",
    );
    expect(failed).toMatchObject({ error: "order_not_found" });
  });

  it("returns an empty result set when there are no open orders", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([] as any);

    const res = await authed("delete", "/orders");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 0, cancelled: 0, orders: [] });
    expect(vi.mocked(sendToEngine)).not.toHaveBeenCalled();
  });
});
