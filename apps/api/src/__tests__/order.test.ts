import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { buildMockUser, generateAccessToken, TEST_USER_ID } from "./helpers";
import { sendToEngine } from "../lib/engine-client";

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── Shared test fixtures ────────────────────────────────────────────────────

const VALID_MARKET_ORDER = {
  symbol: "BTC-PERP",
  type: "MARKET",
  side: "LONG",
  qty: 1,
  price: "50000000000", // price as numeric string — required even for market orders (slippage reference)
};

const VALID_LIMIT_ORDER = {
  symbol: "BTC-PERP",
  type: "LIMIT",
  side: "SHORT",
  qty: 0.5,
  price: "50000000000",
};

const ENGINE_OK_RESPONSE = {
  correlationId: "test-cid",
  userId: TEST_USER_ID,
  type: "create_order" as const,
  ok: true,
  data: {
    orderId: "order-123",
    symbol: "BTC-PERP",
    type: "MARKET",
    side: "LONG",
    qty: 1,
    price: "50000000000",
    slippage: "0",
    leverage: 1,
    isReduceOnly: false,
    filledQty: 1,
    unfilled: 0,
    avgFillPrice: "50000000000",
    status: "FILLED",
    fills: [],
  },
};

const ENGINE_ERROR_RESPONSE = {
  correlationId: "test-cid",
  userId: TEST_USER_ID,
  type: "create_order" as const,
  ok: false,
  error: "insufficient_margin",
};

// ─── Auth guard ──────────────────────────────────────────────────────────────

describe("POST /order — auth guard", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    const res = await request(app).post("/order").send(VALID_MARKET_ORDER);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 401 when token is malformed", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", "Bearer not.a.valid.jwt")
      .send(VALID_MARKET_ORDER);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 401 when token is signed with the wrong secret", async () => {
    const jwt = await import("jsonwebtoken");
    const badToken = jwt.default.sign({ sub: "user-id" }, "wrong-secret", {
      expiresIn: "15m",
    });

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${badToken}`)
      .send(VALID_MARKET_ORDER);

    expect(res.status).toBe(401);
  });

  it("returns 401 when token is valid but user no longer exists in DB", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const token = generateAccessToken();

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_MARKET_ORDER);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });
});

// ─── Input validation ────────────────────────────────────────────────────────

describe("POST /order — input validation", () => {
  let token: string;

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
    token = generateAccessToken();
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when symbol is missing", async () => {
    const { symbol: _, ...noSymbol } = VALID_MARKET_ORDER;
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(noSymbol);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when type is not a valid enum value", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, type: "spot" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when side is not LONG or SHORT", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, side: "buy" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when qty is zero", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, qty: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when qty is negative", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, qty: -1 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when price is sent as a JSON number instead of a string", async () => {
    // price must be a string to avoid JS number precision loss on large integers
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, price: 50000000000 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when price contains non-digit characters", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, price: "500.00" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when price is zero", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, price: "0" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when leverage is not a positive integer", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, leverage: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when leverage is a float", async () => {
    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, leverage: 2.5 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});

// ─── Happy path — market order ────────────────────────────────────────────────

describe("POST /order — MARKET order", () => {
  let token: string;

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
    token = generateAccessToken();
  });

  it("returns 200 and forwards the engine response on success", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_MARKET_ORDER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("serializes price and slippage as strings in the engine payload", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_MARKET_ORDER);

    expect(vi.mocked(sendToEngine)).toHaveBeenCalledWith(
      "create_order",
      expect.objectContaining({
        price: expect.stringMatching(/^\d+$/),
        slippage: expect.stringMatching(/^\d+$/),
      }),
      expect.any(String),
    );
  });

  it("accepts a non-zero slippage value", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_MARKET_ORDER, slippage: 50 }); // 50 bps = 0.5%

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("applies the specified leverage (default is 1 when omitted)", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_MARKET_ORDER); // no leverage field

    expect(vi.mocked(sendToEngine)).toHaveBeenCalledWith(
      "create_order",
      expect.objectContaining({ leverage: 1 }),
      expect.any(String),
    );
  });

  it("passes userId from the auth token to the engine", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_MARKET_ORDER);

    expect(vi.mocked(sendToEngine)).toHaveBeenCalledWith(
      "create_order",
      expect.any(Object),
      TEST_USER_ID,
    );
  });

  it("returns 400 when engine rejects the order", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_ERROR_RESPONSE as any);

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_MARKET_ORDER);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "INVALID_INPUT" });
  });
});

// ─── Happy path — limit order ─────────────────────────────────────────────────

describe("POST /order — LIMIT order", () => {
  let token: string;

  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
    token = generateAccessToken();
  });

  it("returns 200 and forwards the engine response on success", async () => {
    vi.mocked(sendToEngine).mockResolvedValue({
      ...ENGINE_OK_RESPONSE,
      data: { ...ENGINE_OK_RESPONSE.data, type: "LIMIT", side: "SHORT" },
    } as any);

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_LIMIT_ORDER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it("accepts fractional qty for a limit order", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_LIMIT_ORDER, qty: 0.001 });

    expect(res.status).toBe(200);
  });

  it("forwards the exact price string to the engine without coercion", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_LIMIT_ORDER, price: "99999999999999" });

    expect(vi.mocked(sendToEngine)).toHaveBeenCalledWith(
      "create_order",
      expect.objectContaining({ price: "99999999999999" }),
      expect.any(String),
    );
  });

  it("accepts leverage up to the schema maximum", async () => {
    vi.mocked(sendToEngine).mockResolvedValue(ENGINE_OK_RESPONSE as any);

    const res = await request(app)
      .post("/order")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_LIMIT_ORDER, leverage: 10 });

    expect(res.status).toBe(200);
  });
});
