import { NextFunction, Request, Response } from "express";
import { AppError, ErrorCode } from "../errors/AppError";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { prisma } from "@repo/db";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new Error();

    const sessionUser = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as {
      sub: string;
    };

    const user = await prisma.user.findUnique({
      where: {
        id: sessionUser.sub,
      },
    });

    if (!user) throw new Error();

    req.userId = user.id;
    next();
  } catch {
    next(new AppError(401, ErrorCode.UNAUTHORIZED, "Unauthorized"));
  }
};
