import { AuthInput } from "@repo/schema";
import {
  createUser,
  getUserById,
  getUserByUsername,
} from "../repository/user.repository";
import { AppError, ErrorCode } from "../errors/AppError";
import bcrypt from "bcrypt";
import { getAccessToken, getRefreshToken } from "../lib/utils";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { sendToEngine } from "../lib/engine-client";
import { createBalanceAccount } from "../repository/balances.repository";
import { logger } from "@repo/logger";

export const signUp = async (data: AuthInput) => {
  const { username, password } = data;

  const existingUser = await getUserByUsername(username);
  if (existingUser)
    throw new AppError(409, ErrorCode.CONFLICT, "User already exists");

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await createUser(username, hashedPassword);

  await createBalanceAccount(user.id);

  void sendToEngine(
    "create_user",
    { userId: user.id, username: user.username },
    user.id,
  ).catch((err) =>
    logger.error(
      { err: String(err), userId: user.id },
      "create_user engine dispatch did not confirm",
    ),
  );

  const accessToken = getAccessToken(user);
  const refreshToken = getRefreshToken(user.id);

  return { accessToken, refreshToken };
};

export const signIn = async (data: AuthInput) => {
  const { username, password } = data;

  const user = await getUserByUsername(username);
  if (!user) throw new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized");

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch)
    throw new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized");

  const accessToken = getAccessToken(user);
  const refreshToken = getRefreshToken(user.id);

  return { accessToken, refreshToken };
};

export const refresh = async (refreshToken?: string) => {
  if (!refreshToken)
    throw new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized");

  let sub: string;
  try {
    ({ sub } = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as {
      sub: string;
    });
  } catch {
    throw new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized");
  }

  const user = await getUserById(sub);
  if (!user) throw new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized");

  return getAccessToken(user);
};
