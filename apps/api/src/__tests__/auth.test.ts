import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { app } from "../app";
import {
  buildMockUser,
  TEST_PASSWORD,
  TEST_USERNAME,
  generateRefreshToken,
  generateExpiredRefreshToken,
} from "./helpers";

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── Signup ──────────────────────────────────────────────────────────────────

describe("POST /auth/signup", () => {
  it("returns 200 with a signed access token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(buildMockUser() as any);

    const res = await request(app)
      .post("/auth/signup")
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { token: expect.any(String) },
    });
  });

  it("sets an HttpOnly SameSite=Strict refresh cookie", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(buildMockUser() as any);

    const res = await request(app)
      .post("/auth/signup")
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    const cookies = res.headers["set-cookie"] as string[] | undefined;
    const refreshCookie = cookies?.find((c) => c.startsWith("refresh="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Strict");
  });

  it("returns 409 when username is already taken", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);

    const res = await request(app)
      .post("/auth/signup")
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: "CONFLICT" });
  });

  it("returns 400 when username is shorter than 4 characters", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ username: "abc", password: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(res.body.errors).toBeInstanceOf(Array);
  });

  it("returns 400 when password is shorter than 4 characters", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ username: TEST_USERNAME, password: "123" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when body is missing required fields", async () => {
    const res = await request(app).post("/auth/signup").send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 400 when body is not JSON", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .set("Content-Type", "text/plain")
      .send("not json");

    expect(res.status).toBe(400);
  });
});

// ─── Signin ──────────────────────────────────────────────────────────────────

describe("POST /auth/signin", () => {
  it("returns 200 with a signed access token on valid credentials", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);

    const res = await request(app)
      .post("/auth/signin")
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { token: expect.any(String) },
    });
  });

  it("sets an HttpOnly refresh cookie on successful signin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);

    const res = await request(app)
      .post("/auth/signin")
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    const cookies = res.headers["set-cookie"] as string[] | undefined;
    const refreshCookie = cookies?.find((c) => c.startsWith("refresh="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
  });

  it("returns 401 when user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post("/auth/signin")
      .send({ username: "nosuchuser", password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 401 when password is incorrect", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);

    const res = await request(app)
      .post("/auth/signin")
      .send({ username: TEST_USERNAME, password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 400 when input fails schema validation", async () => {
    const res = await request(app)
      .post("/auth/signin")
      .send({ username: "ab", password: TEST_PASSWORD }); // username < 4 chars

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

describe("POST /auth/refresh", () => {
  it("returns 200 with a new access token when refresh cookie is valid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(buildMockUser() as any);
    const refreshToken = generateRefreshToken();

    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { token: expect.any(String) },
    });
  });

  it("returns 401 when no refresh cookie is present", async () => {
    const res = await request(app).post("/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 401 when refresh token is malformed", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", "refresh=not.a.valid.jwt");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 401 when refresh token is signed with wrong secret", async () => {
    const jwt = await import("jsonwebtoken");
    const badToken = jwt.default.sign({ sub: "user-id" }, "wrong-secret", {
      expiresIn: "7d",
    });

    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh=${badToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 401 when refresh token is expired", async () => {
    const expiredToken = generateExpiredRefreshToken();

    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });

  it("returns 401 when the user no longer exists in the database", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const refreshToken = generateRefreshToken();

    const res = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh=${refreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
  });
});
