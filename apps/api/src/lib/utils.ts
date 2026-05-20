import { User } from "@repo/db";
import jwt from "jsonwebtoken";
import { env } from "./env";

export const getAccessToken = (user: User) => {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      kycStatus: user.kycStatus,
      isActive: user.isActive,
    },
    env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" },
  );
};

export const getRefreshToken = (userId: string) => {
  return jwt.sign({ sub: userId }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};
