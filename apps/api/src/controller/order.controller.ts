import { orderInputSchema } from "@repo/schema";
import { Request, Response } from "express";

export const createOrder = async (req: Request, res: Response) => {
  orderInputSchema.parse(req.body);
  // TODO: ISSUE-03 — route to engine once order book is implemented
  res.status(501).json({ success: false, code: "NOT_IMPLEMENTED", message: "Order creation not yet implemented" });
};
