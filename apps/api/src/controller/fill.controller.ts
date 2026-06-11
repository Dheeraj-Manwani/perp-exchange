import { Request, Response } from "express";
import {
  marketSymbolParam,
  publicTradesQuery,
  userFillsQuery,
} from "@repo/schema";
import * as fillService from "../service/fill.service";
import { ok } from "../lib/response";

// Public: GET /markets/:symbol/trades
export const getPublicTrades = async (req: Request, res: Response) => {
  const symbol = marketSymbolParam.parse(req.params.symbol);
  const query = publicTradesQuery.parse(req.query);
  const data = await fillService.getPublicTrades(symbol, query);
  ok(res, data);
};

// Auth: GET /fills
export const getUserFills = async (req: Request, res: Response) => {
  const query = userFillsQuery.parse(req.query);
  const data = await fillService.getUserFills(req.userId!, query);
  ok(res, data);
};

// Auth: GET /fills/:symbol
export const getUserFillsBySymbol = async (req: Request, res: Response) => {
  const symbol = marketSymbolParam.parse(req.params.symbol);
  const query = userFillsQuery.parse(req.query);
  const data = await fillService.getUserFills(req.userId!, query, symbol);
  ok(res, data);
};
