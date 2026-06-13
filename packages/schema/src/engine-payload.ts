import z from "zod";
import { OrderSide } from "./orders";

export const onRampPayload = z.object({
  userId: z.string(),
  amount: z.string(),
});

export type OnRampPayload = z.infer<typeof onRampPayload>;

export const signupPayload = z.object({
  userId: z.string(),
  username: z.string(),
});

export type SignupPayload = z.infer<typeof signupPayload>;

export const cancelOrderPayload = z.object({
  orderId: z.string(),
  symbol: z.string(),
  side: z.enum(["LONG", "SHORT"]),
});

export type CancelOrderPayload = z.infer<typeof cancelOrderPayload>;

export const indexPriceChangePayload = z.object({
  marketPrices: z.record(z.string(), z.string()),
});

export type IndexPriceChangePayload = z.infer<typeof indexPriceChangePayload>;

export const fundingSettlePayload = z.object({
  period: z.string(),
});

export type FundingSettlePayload = z.infer<typeof fundingSettlePayload>;

export const getIndexPricePayload = z.object({
  symbol: z.string(),
});

export type GetIndexPricePayload = z.infer<typeof getIndexPricePayload>;

export interface GetIndexPriceEngineResponse {
  symbol: string;
  indexPrice: string;
  updatedAt: number;
}

export const MAX_ORDERBOOK_DEPTH = 500;
export const DEFAULT_ORDERBOOK_DEPTH = 20;

export const getOrderbookPayload = z.object({
  symbol: z.string(),
  depth: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ORDERBOOK_DEPTH)
    .default(DEFAULT_ORDERBOOK_DEPTH),
});

export type GetOrderbookPayload = z.infer<typeof getOrderbookPayload>;

export const getPositionsPayload = z.object({}).default({});

export type GetPositionsPayload = z.infer<typeof getPositionsPayload>;

export const getPositionPayload = z.object({ symbol: z.string() });

export type GetPositionPayload = z.infer<typeof getPositionPayload>;

export const getMarkPricePayload = z.object({ symbol: z.string() });

export type GetMarkPricePayload = z.infer<typeof getMarkPricePayload>;

export const getAccountSummaryPayload = z.object({}).default({});

export type GetAccountSummaryPayload = z.infer<typeof getAccountSummaryPayload>;

export type OrderbookLevel = [string, string];

export interface GetOrderbookEngineResponse {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  lastUpdateId: number;
}

export interface PositionView {
  positionId: string;
  market: string;
  side: OrderSide;
  qty: number;
  margin: string;
  leverage: number;
  averagePrice: string;
  liquidationPrice: string;
  markPrice: string;
  unrealisedPnl: string;
}

export interface GetPositionsEngineResponse {
  positions: PositionView[];
}

export interface GetPositionEngineResponse {
  position: PositionView | null;
}

export interface GetMarkPriceEngineResponse {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  updatedAt: number;
}

export interface GetAccountSummaryEngineResponse {
  equity: string;
  availableMargin: string;
  usedMargin: string;
  unrealisedPnl: string;
}
