import { Request, Response } from "express";
import { marketSymbolParam, positionHistoryQuery } from "@repo/schema";
import * as positionsService from "../service/positions.service";
import { ok } from "../lib/response";

// GET /positions
export const getPositions = async (req: Request, res: Response) => {
  const data = await positionsService.getPositions(req.userId!);
  ok(res, data);
};

// GET /positions/history
export const getPositionHistory = async (req: Request, res: Response) => {
  const query = positionHistoryQuery.parse(req.query);
  const data = await positionsService.getPositionHistory(req.userId!, query);
  ok(res, data);
};

// GET /positions/:symbol
export const getPosition = async (req: Request, res: Response) => {
  const symbol = marketSymbolParam.parse(req.params.symbol);
  const data = await positionsService.getPosition(req.userId!, symbol);
  ok(res, data);
};
