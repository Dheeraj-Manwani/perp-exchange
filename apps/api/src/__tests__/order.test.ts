import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { buildMockUser, generateAccessToken } from "./helpers";

beforeEach(() => {
  vi.resetAllMocks();
});

const VALID_MARKET_ORDER = {
  symbol: "BTC-PERP",
  type: "market",
  side: "long",
  qty: 1,
};

const VALID_LIMIT_ORDER = {
  symbol: "BTC-PERP",
  type: "limit",
  side: "short",
  qty: 0.5,
  // ISSUE-09: price uses z.bigint() which rejects JSON numbers; omitted until fixed.
};

describe("POST /order", () => {
  // ─── Auth guard ────────────────────────────────────────────────────────────

  describe("auth guard", () => {
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

    it("returns 401 when token is valid but user no longer exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/order")
        .set("Authorization", `Bearer ${token}`)
        .send(VALID_MARKET_ORDER);

      expect(res.status).toBe(401);
    });
  });

  // ─── Input validation ──────────────────────────────────────────────────────

  describe("input validation", () => {
    it("returns 400 when body is empty", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/order")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    });

    it("returns 400 when order type is not a valid enum value", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/order")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...VALID_MARKET_ORDER, type: "invalid_type" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    });

    it("returns 400 when side is not a valid enum value", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/order")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...VALID_MARKET_ORDER, side: "buy" }); // schema uses "long"/"short"

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    });

    it("returns 400 when qty is zero or negative", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/order")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...VALID_MARKET_ORDER, qty: -1 });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    });

    it("returns 400 when symbol is missing", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/order")
        .set("Authorization", `Bearer ${token}`)
        .send({ type: "market", side: "long", qty: 1 });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    });

    it("returns 501 for a valid market order (engine not yet implemented)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/order")
        .set("Authorization", `Bearer ${token}`)
        .send(VALID_MARKET_ORDER);

      // 501 until ISSUE-03 (order book) is implemented.
      expect(res.status).toBe(501);
      expect(res.body).toMatchObject({ success: false, code: "NOT_IMPLEMENTED" });
    });

    it.todo(
      "returns 201 for a valid limit order [blocked by ISSUE-09: z.bigint() rejects JSON price]",
    );
  });
});
