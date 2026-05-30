import { prisma } from "@repo/db";
import { SUPPORTED_EXCHANGES } from "@repo/schema";

export type MarketInfo = { market: string; decimals: number };

export const getMarketFeedMap = async (): Promise<Map<string, MarketInfo>> => {
  const rows = await prisma.exchangeSymbol.findMany({
    where: {
      exchange: SUPPORTED_EXCHANGES.binance,
      market: { isActive: true },
    },
    select: {
      symbol: true,
      market: { select: { symbol: true, decimals: true } },
    },
  });
  return new Map(
    rows.map((r) => [
      r.symbol.toUpperCase(),
      { market: r.market.symbol, decimals: r.market.decimals },
    ]),
  );
};
