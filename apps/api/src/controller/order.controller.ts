import {
  cancelAllOrdersQuery,
  cancelOrderInputSchema,
  openOrdersQuery,
  orderHistoryQuery,
  orderIdParam,
  orderInputSchema,
} from "@repo/schema";
import { Request, Response, NextFunction } from "express";
import {
  cancelAllOrders as cancelAllOrdersService,
  cancelOrder as cancelOrderService,
  createOrder as createOrderService,
  getOpenOrders as getOpenOrdersService,
  getOrderById as getOrderByIdService,
  getOrderHistory as getOrderHistoryService,
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

export const getOpenOrders = async (req: Request, res: Response) => {
  const query = openOrdersQuery.parse(req.query);
  const data = await getOpenOrdersService(req.userId!, query);
  ok(res, data);
};

export const getOrderHistory = async (req: Request, res: Response) => {
  const query = orderHistoryQuery.parse(req.query);
  const data = await getOrderHistoryService(req.userId!, query);
  ok(res, data);
};

export const getOrder = async (req: Request, res: Response) => {
  const orderId = orderIdParam.parse(req.params.orderId);
  const data = await getOrderByIdService(req.userId!, orderId);
  ok(res, data);
};

export const cancelAllOrders = async (req: Request, res: Response) => {
  const { symbol } = cancelAllOrdersQuery.parse(req.query);
  const data = await cancelAllOrdersService(req.userId!, symbol);
  ok(res, data);
};
