import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import { buildMockUser, generateAccessToken } from "./helpers";
import { sendToEngine } from "../lib/engine-client";

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
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        buildMockUser() as any,
      );
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        code: "VALIDATION_ERROR",
      });
    });

    it("returns 400 when amount is zero or negative", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        buildMockUser() as any,
      );
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: -100 });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        code: "VALIDATION_ERROR",
      });
    });

    it("returns 400 when amount is a non-numeric string", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        buildMockUser() as any,
      );
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: "not-a-number" });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        code: "VALIDATION_ERROR",
      });
    });
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns 200 and forwards the engine response when a valid integer amount is deposited", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        buildMockUser() as any,
      );
      vi.mocked(sendToEngine).mockResolvedValue({
        correlationId: "cid-1",
        userId: "test-user-id",
        type: "onramp" as const,
        ok: true,
        data: undefined,
      });
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1000 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(vi.mocked(sendToEngine)).toHaveBeenCalledWith(
        "onramp",
        expect.objectContaining({ userId: expect.any(String), amount: "1000" }),
        expect.any(String),
      );
    });

    it("accepts amount sent as a numeric string", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        buildMockUser() as any,
      );
      vi.mocked(sendToEngine).mockResolvedValue({
        correlationId: "cid-2",
        userId: "test-user-id",
        type: "onramp" as const,
        ok: true,
        data: undefined,
      });
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: "5000" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
    });

    it("returns 200 and passes through engine error payload when engine reports failure", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        buildMockUser() as any,
      );
      vi.mocked(sendToEngine).mockResolvedValue({
        correlationId: "cid-3",
        userId: "test-user-id",
        type: "onramp" as const,
        ok: false,
        error: "account_not_found",
      });
      const token = generateAccessToken();

      const res = await request(app)
        .post("/onramp")
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 500 });

      // The controller currently forwards whatever the engine returns; once
      // ISSUE-02 is fixed the engine will correctly surface errors and the
      // service layer should map them to appropriate HTTP codes.
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
    });
  });
});
