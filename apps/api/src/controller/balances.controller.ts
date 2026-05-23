import { Request, Response } from "express";
import { onRampInuput } from "@repo/schema";
import { onRamp as onRampService } from "../service/balances.service";
import { ok } from "../lib/response";

export const onRamp = async (req: Request, res: Response) => {
  const input = onRampInuput.parse(req.body);
  const data = await onRampService(req.userId!, input.amount);
  ok(res, data);
};
