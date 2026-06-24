import {
  FUNDING_INTERVAL_SECONDS,
  FundingRateHistoryQuery,
  GetIndexPriceEngineResponse,
  GetMarkPriceEngineResponse,
  GetOrderbookEngineResponse,
} from "@repo/schema";
import { AppError, ErrorCode } from "../errors/AppError";
import { sendToEngineWithPubSubResponse } from "../lib/engine-client";
import * as marketRepository from "../repository/market.repository";

const FUNDING_INTERVAL_MS = FUNDING_INTERVAL_SECONDS * 1000;

// Funding settles at 00/08/16 UTC — every multiple of 8h since epoch, so the
// next boundary is the next multiple strictly after `now`.
export const getNextFundingTime = (now: Date = new Date()): Date => {
  return new Date(
    (Math.floor(now.getTime() / FUNDING_INTERVAL_MS) + 1) * FUNDING_INTERVAL_MS,
  );
};

const requireMarket = async (symbol: string) => {
  const market = await marketRepository.findMarketBySymbol(symbol);
  if (!market) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Unknown market: ${symbol}`);
  }
  return market;
};

export const getMarkets = async () => {
  return marketRepository.findActiveMarkets();
};

export const getMarket = async (symbol: string) => {
  return requireMarket(symbol);
};

export const getIndexPrice = async (symbol: string) => {
  const market = await requireMarket(symbol);

  const response = await sendToEngineWithPubSubResponse(
    "get_index_price",
    { symbol: market.symbol },
    "system",
  );

  if (!response.ok || !response.data) {
    throw new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      response.error ?? `Index price unavailable for ${market.symbol}`,
    );
  }

  const { indexPrice, updatedAt } =
    response.data as unknown as GetIndexPriceEngineResponse;

  if (indexPrice === "0" || updatedAt === 0) {
    throw new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      `Index price unavailable for ${market.symbol}`,
    );
  }

  return { symbol: market.symbol, indexPrice, updatedAt };
};

export const getMarkPrice = async (symbol: string) => {
  const market = await requireMarket(symbol);

  const response = await sendToEngineWithPubSubResponse(
    "get_mark_price",
    { symbol: market.symbol },
    "system",
  );

  if (!response.ok || !response.data) {
    throw new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      response.error ?? `Mark price unavailable for ${market.symbol}`,
    );
  }

  const { markPrice, indexPrice, updatedAt } =
    response.data as unknown as GetMarkPriceEngineResponse;

  // No trades and no index yet → engine has no basis for a mark price.
  if (markPrice === "0") {
    throw new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      `Mark price unavailable for ${market.symbol}`,
    );
  }

  return { symbol: market.symbol, markPrice, indexPrice, updatedAt };
};

export const getFundingRate = async (symbol: string) => {
  const market = await requireMarket(symbol);
  const latest = await marketRepository.findLatestFundingRate(market.id);

  return {
    symbol: market.symbol,
    rateBps: latest?.rateBps ?? "0",
    markPrice: latest?.markPrice ?? null,
    settledAt: latest?.settledAt ?? null,
    nextFundingTime: getNextFundingTime(),
    intervalSeconds: FUNDING_INTERVAL_SECONDS,
  };
};

export const getFundingRateHistory = async (
  symbol: string,
  query: FundingRateHistoryQuery,
) => {
  const market = await requireMarket(symbol);

  const [rows, total] = await Promise.all([
    marketRepository.findFundingRateHistory(market.id, query.limit, query.page),
    marketRepository.countFundingRates(market.id),
  ]);

  return {
    symbol: market.symbol,
    items: rows.map((r) => ({
      period: r.period,
      rateBps: r.rateBps,
      markPrice: r.markPrice,
      settledAt: r.settledAt,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
};

export type OrderbookDto = {
  symbol: string;
  bids: GetOrderbookEngineResponse["bids"];
  asks: GetOrderbookEngineResponse["asks"];
  lastUpdateId: number;
};

const ORDERBOOK_CACHE_TTL_MS = 200;

const orderbookCache = new Map<
  string,
  { expires: number; promise: Promise<OrderbookDto> }
>();

export const getOrderbook = async (
  symbol: string,
  depth: number,
): Promise<OrderbookDto> => {
  const market = await requireMarket(symbol);
  const key = `${market.symbol}:${depth}`;
  const now = Date.now();

  const cached = orderbookCache.get(key);
  if (cached && cached.expires > now) return cached.promise;

  const promise = (async (): Promise<OrderbookDto> => {
    const response = await sendToEngineWithPubSubResponse(
      "get_orderbook",
      { symbol: market.symbol, depth },
      "system",
    );

    if (!response.ok || !response.data) {
      throw new AppError(
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
        response.error ?? `Orderbook unavailable for ${market.symbol}`,
      );
    }

    const { bids, asks, lastUpdateId } =
      response.data as unknown as GetOrderbookEngineResponse;

    return {
      symbol: market.symbol,
      bids: bids ?? [],
      asks: asks ?? [],
      lastUpdateId: lastUpdateId ?? 0,
    };
  })();

  orderbookCache.set(key, {
    expires: now + ORDERBOOK_CACHE_TTL_MS,
    promise,
  });
  // Don't let a failed query stick around in the cache.
  promise.catch(() => {
    if (orderbookCache.get(key)?.promise === promise)
      orderbookCache.delete(key);
  });

  return promise;
};
