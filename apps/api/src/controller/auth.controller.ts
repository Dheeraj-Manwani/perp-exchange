import { authInput } from "@repo/schema";
import { Request, Response } from "express";
import {
  signUp as signUpService,
  signIn as signInService,
  refresh as refreshService,
} from "../service/auth.service";
import { ok } from "../lib/response";
import { env } from "../lib/env";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
};

export const signUp = async (req: Request, res: Response) => {
  const input = authInput.parse(req.body);
  const data = await signUpService(input);
  res.cookie("refresh", data.refreshToken, cookieOptions);
  ok(res, { token: data.accessToken });
};

export const signIn = async (req: Request, res: Response) => {
  const input = authInput.parse(req.body);
  const data = await signInService(input);
  res.cookie("refresh", data.refreshToken, cookieOptions);
  ok(res, { token: data.accessToken });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refresh;
  const token = await refreshService(refreshToken);

  ok(res, { token });
};
