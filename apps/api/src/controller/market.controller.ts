import { Request, Response } from "express";
import { fundingRateHistoryQuery, marketSymbolParam } from "@repo/schema";
import * as marketService from "../service/market.service";
import { ok } from "../lib/response";

export const getMarkets = async (_req: Request, res: Response) => {
  const data = await marketService.getMarkets();
  ok(res, data);
};

export const getMarket = async (req: Request, res: Response) => {
  const symbol = marketSymbolParam.parse(req.params.symbol);
  const data = await marketService.getMarket(symbol);
  ok(res, data);
};

export const getIndexPrice = async (req: Request, res: Response) => {
  const symbol = marketSymbolParam.parse(req.params.symbol);
  const data = await marketService.getIndexPrice(symbol);
  ok(res, data);
};

export const getFundingRate = async (req: Request, res: Response) => {
  const symbol = marketSymbolParam.parse(req.params.symbol);
  const data = await marketService.getFundingRate(symbol);
  ok(res, data);
};

export const getFundingRateHistory = async (req: Request, res: Response) => {
  const symbol = marketSymbolParam.parse(req.params.symbol);
  const query = fundingRateHistoryQuery.parse(req.query);
  const data = await marketService.getFundingRateHistory(symbol, query);
  ok(res, data);
};
