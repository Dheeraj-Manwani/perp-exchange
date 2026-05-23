import { Request, Response } from "express";
import { onRampInuput } from "@repo/schema";
import { onRamp as onRampService } from "../service/balances.service";

export const onRamp = async (req: Request, res: Response) => {
  const input = onRampInuput.parse(req.body);
  const response = await onRampService(input.amount);
};
