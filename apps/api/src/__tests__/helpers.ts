import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const TEST_USERNAME = "testuser";
export const TEST_PASSWORD = "Password123!";

// Hashed once at module load. Salt rounds = 1 for test speed.
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 1);

export type MockUser = {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  name: string | null;
  isActive: boolean;
  kycStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

export function buildMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: TEST_USER_ID,
    username: TEST_USERNAME,
    email: null,
    passwordHash: TEST_PASSWORD_HASH,
    name: null,
    isActive: true,
    kycStatus: "PENDING",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function generateAccessToken(userId: string = TEST_USER_ID): string {
  return jwt.sign(
    {
      sub: userId,
      username: TEST_USERNAME,
      kycStatus: "PENDING",
      isActive: true,
    },
    process.env["ACCESS_TOKEN_SECRET"]!,
    { expiresIn: "15m" },
  );
}

export function generateRefreshToken(userId: string = TEST_USER_ID): string {
  return jwt.sign({ sub: userId }, process.env["REFRESH_TOKEN_SECRET"]!, {
    expiresIn: "7d",
  });
}

export function generateExpiredRefreshToken(
  userId: string = TEST_USER_ID,
): string {
  // exp set 60s in the past — reliably expired on any machine
  return jwt.sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) - 60 },
    process.env["REFRESH_TOKEN_SECRET"]!,
  );
}
