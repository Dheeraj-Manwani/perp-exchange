import { PublicTradesQuery, UserFillsQuery } from "@repo/schema";
import { AppError, ErrorCode } from "../errors/AppError";
import * as fillRepository from "../repository/fill.repository";
import * as marketRepository from "../repository/market.repository";

const requireMarket = async (symbol: string) => {
  const market = await marketRepository.findMarketBySymbol(symbol);
  if (!market) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Unknown market: ${symbol}`);
  }
  return market;
};

// Public recent-trades tape: each trade tagged with the aggressor (taker) side
// so the UI can color buys vs sells.
export const getPublicTrades = async (
  symbol: string,
  query: PublicTradesQuery,
) => {
  const market = await requireMarket(symbol);
  const rows = await fillRepository.findRecentTrades(market.id, query.limit);

  return {
    symbol: market.symbol,
    trades: rows.map((f) => ({
      id: f.id,
      price: f.price,
      qty: f.qty,
      takerSide: f.takerOrder.side,
      createdAt: f.createdAt,
    })),
  };
};

type UserFillRow = Awaited<
  ReturnType<typeof fillRepository.findUserFills>
>[number];

const toUserFillDto = (f: UserFillRow, userId: string) => {
  const isTaker = f.takerUserId === userId;
  return {
    id: f.id,
    symbol: f.market.symbol,
    orderId: isTaker ? f.takerOrderId : f.makerOrderId,
    role: isTaker ? ("TAKER" as const) : ("MAKER" as const),
    side: isTaker ? f.takerOrder.side : f.makerOrder.side,
    price: f.price,
    qty: f.qty,
    createdAt: f.createdAt,
  };
};

// User's own fills, optionally scoped to one market. A row matches when the user
// is either the taker or the maker; role/side are resolved per row.
export const getUserFills = async (
  userId: string,
  query: UserFillsQuery,
  symbol?: string,
) => {
  const marketId = symbol ? (await requireMarket(symbol)).id : undefined;

  const [rows, total] = await Promise.all([
    fillRepository.findUserFills(userId, marketId, query.limit, query.page),
    fillRepository.countUserFills(userId, marketId),
  ]);

  return {
    items: rows.map((f) => toUserFillDto(f, userId)),
    page: query.page,
    limit: query.limit,
    total,
  };
};
