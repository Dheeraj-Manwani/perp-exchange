import { cancelOrderInputSchema, orderInputSchema } from "@repo/schema";
import { Request, Response, NextFunction } from "express";
import {
  cancelOrder as cancelOrderService,
  createOrder as createOrderService,
} from "../service/order.service";
import { ok } from "../lib/response";
import { AppError, ErrorCode } from "../errors/AppError";

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = orderInputSchema.parse(req.body);
    const response = await createOrderService(data, req.userId!);
    if (!response.ok) {
      next(
        new AppError(
          400,
          ErrorCode.INVALID_INPUT,
          response.error ?? "order_rejected",
        ),
      );
      return;
    }
    ok(res, response.data);
  } catch (err) {
    next(err);
  }
};

export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = req.params.id as string;
    const data = cancelOrderInputSchema.parse(req.body);
    const response = await cancelOrderService(orderId, data, req.userId!);
    if (!response.ok) {
      next(
        new AppError(
          400,
          ErrorCode.INVALID_INPUT,
          response.error ?? "cancel_rejected",
        ),
      );
      return;
    }
    ok(res, response.data);
  } catch (err) {
    next(err);
  }
};
