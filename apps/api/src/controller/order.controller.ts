import { orderInputSchema } from "@repo/schema";
import { Request, Response } from "express";
import { createOrder as createOrderService } from "../service/order.service";

export const createOrder = async (req: Request, res: Response) => {
  const data = orderInputSchema.parse(req.body);
  const response = await createOrderService(data, req.userId!);

  res.status(200).json({
    success: response.ok,
    data: response.data,
  });
};
