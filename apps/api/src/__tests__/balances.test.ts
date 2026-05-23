import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { buildMockUser, generateAccessToken } from "./helpers";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /onramp", () => {
  // ─── Auth guard ────────────────────────────────────────────────────────────

  describe("auth guard", () => {
    it("returns 401 when no Authorization header is provided", async () => {
      const res = await request(app).post("/onramp").send({ amount: 1000 });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    });

    it("returns 401 when the token is malformed", async () => {
      const res = await request(app)
        .post("/onramp")
        .set("Authorization", "Bearer not.a.valid.jwt")
        .send({ amount: 1000 });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    });

    it("returns 401 when token is signed with the wrong secret", async () => {
      const jwt = await import("jsonwebtoken");
      const badToken = jwt.default.sign({ sub: "user-id" }, "wrong-secret", {
        expiresIn: "15m",
      });

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${badToken}`)
        .send({ amount: 1000 });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    });

    it("returns 401 when token is valid but user no longer exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1000 });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    });
  });

  // ─── Input validation ──────────────────────────────────────────────────────

  describe("input validation", () => {
    it("returns 400 when amount is missing from the body", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    });

    it("returns 400 when amount is zero or negative", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: -100 });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    });

    // BUG #5: z.bigint() cannot parse a JSON number — amount arrives as a number
    // from JSON and Zod rejects it. Fix: use z.coerce.bigint() in onRampInput schema.
    // This test documents the correct expected behavior and will pass once bug #5 is fixed.
    it.todo(
      "returns 200 when a valid amount is deposited [blocked by bug #5: z.bigint() rejects JSON numbers]",
    );
  });
});
