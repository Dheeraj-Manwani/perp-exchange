import z from "zod";
import {
  DEFAULT_ORDERBOOK_DEPTH,
  MAX_ORDERBOOK_DEPTH,
} from "./engine-payload";

export const marketSymbolParam = z
  .string()
  .min(1)
  .transform((s) => s.toUpperCase());

export const fundingRateHistoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

export type FundingRateHistoryQuery = z.infer<typeof fundingRateHistoryQuery>;

// GET /markets/:symbol/orderbook — ?depth (default 20, capped at 500 like
// Binance's limit tiers).
export const orderbookQuery = z.object({
  depth: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ORDERBOOK_DEPTH)
    .default(DEFAULT_ORDERBOOK_DEPTH),
});

export type OrderbookQuery = z.infer<typeof orderbookQuery>;
