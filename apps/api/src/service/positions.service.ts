import {
  EngineResponse,
  GetPositionEngineResponse,
  GetPositionsEngineResponse,
  PositionHistoryQuery,
} from "@repo/schema";
import { AppError, ErrorCode } from "../errors/AppError";
import { sendToEngineWithPubSubResponse } from "../lib/engine-client";
import * as marketRepository from "../repository/market.repository";
import * as positionsRepository from "../repository/positions.repository";

const unwrap = <T>(response: EngineResponse, fallback: string): T => {
  if (!response.ok || !response.data) {
    throw new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      response.error ?? fallback,
    );
  }
  return response.data as unknown as T;
};

export const getPositions = async (userId: string) => {
  const response = await sendToEngineWithPubSubResponse(
    "get_positions",
    {},
    userId,
  );
  const { positions } = unwrap<GetPositionsEngineResponse>(
    response,
    "Positions unavailable",
  );
  return positions;
};

export const getPosition = async (userId: string, symbol: string) => {
  const market = await marketRepository.findMarketBySymbol(symbol);
  if (!market) {
    throw new AppError(404, ErrorCode.NOT_FOUND, `Unknown market: ${symbol}`);
  }

  const response = await sendToEngineWithPubSubResponse(
    "get_position",
    { symbol: market.symbol },
    userId,
  );
  const { position } = unwrap<GetPositionEngineResponse>(
    response,
    `Position unavailable for ${market.symbol}`,
  );

  if (!position) {
    throw new AppError(
      404,
      ErrorCode.POSITION_NOT_FOUND,
      `No open position for ${market.symbol}`,
    );
  }
  return position;
};

type HistoryRow = Awaited<
  ReturnType<typeof positionsRepository.findPositionHistory>
>[number];

const toHistoryDto = (t: HistoryRow) => ({
  id: t.id,
  symbol: t.market?.symbol ?? null,
  realisedPnl: t.amount,
  balanceAfter: t.balanceAfter,
  referenceId: t.referenceId,
  createdAt: t.createdAt,
});

export const getPositionHistory = async (
  userId: string,
  query: PositionHistoryQuery,
) => {
  const [rows, total] = await Promise.all([
    positionsRepository.findPositionHistory(
      userId,
      query.symbol,
      query.limit,
      query.page,
    ),
    positionsRepository.countPositionHistory(userId, query.symbol),
  ]);

  return {
    items: rows.map(toHistoryDto),
    page: query.page,
    limit: query.limit,
    total,
  };
};
