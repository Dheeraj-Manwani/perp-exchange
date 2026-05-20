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

export const signUp = async (data: AuthInput) => {
  const { username, password } = data;

  const existingUser = await getUserByUsername(username);
  if (existingUser)
    throw new AppError(409, ErrorCode.CONFLICT, "User already exists");

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await createUser(username, hashedPassword);

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
  const { sub } = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as {
    sub: string;
  };

  const user = await getUserById(sub);
  if (!user) throw new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized");

  const accessToken = getAccessToken(user);

  return { accessToken };
};
