import {
  GetAccountSummaryEngineResponse,
  GetMarkPriceEngineResponse,
  GetOrderbookEngineResponse,
  GetPositionEngineResponse,
  GetPositionsEngineResponse,
  OrderbookLevel,
  PositionView,
} from "@repo/schema";
import { OrderbookRegistry } from "../core/OrderbookRegistry";
import { Position } from "../core/Position";
import { PositionManager } from "../core/PositionManager";
import { UserRegistry } from "../core/UserRegistry";
import { getMarkPrice } from "../utils/utils";

/**
 * Pure in-memory reads over the live engine state. No mutation, so the request
 * loop replies on the pub/sub channel (see READ_ONLY_ENGINE_TYPES) and skips
 * re-emitting on replayed events.
 */
export class ReadQueryService {
  constructor(
    private readonly users: UserRegistry,
    private readonly orderbooks: OrderbookRegistry,
    private readonly positions: PositionManager,
  ) {}

  getOrderbook(symbol: string, depth: number): GetOrderbookEngineResponse {
    const book = this.orderbooks.get(symbol);
    return {
      symbol,
      bids: book
        .aggregateLevels("bids", depth)
        .map(([price, qty]): OrderbookLevel => [price.toString(), qty.toString()]),
      asks: book
        .aggregateLevels("asks", depth)
        .map(([price, qty]): OrderbookLevel => [price.toString(), qty.toString()]),
      lastUpdateId: book.updateId,
    };
  }

  getPositions(userId: string): GetPositionsEngineResponse {
    return {
      positions: this.positions
        .getOpen(userId)
        .map((pos) => this.toPositionView(pos)),
    };
  }

  getPosition(userId: string, symbol: string): GetPositionEngineResponse {
    const pos = this.positions.get(userId, symbol);
    return { position: pos ? this.toPositionView(pos) : null };
  }

  getMarkPrice(symbol: string): GetMarkPriceEngineResponse {
    const book = this.orderbooks.get(symbol);
    return {
      symbol,
      markPrice: getMarkPrice(book).toString(),
      indexPrice: book.indexPrice.toString(),
      updatedAt: book.indexPriceUpdatedAt,
    };
  }

  getAccountSummary(userId: string): GetAccountSummaryEngineResponse {
    const account = this.users.getById(userId);
    if (!account) throw new Error("Account not found");

    let unrealisedPnl = 0n;
    let positionMargin = 0n;
    for (const pos of this.positions.getOpen(userId)) {
      const markPrice = getMarkPrice(this.orderbooks.get(pos.market));
      unrealisedPnl += pos.computeUnrealizedPnl(markPrice);
      positionMargin += pos.margin;
    }

    const { available, locked } = account.collateral;
    // Wallet balance = free (available) + order-locked + position margin; equity
    // marks that to market with unrealised PnL. Used margin = locked + positions.
    return {
      equity: (available + locked + positionMargin + unrealisedPnl).toString(),
      availableMargin: available.toString(),
      usedMargin: (locked + positionMargin).toString(),
      unrealisedPnl: unrealisedPnl.toString(),
    };
  }

  private toPositionView(pos: Position): PositionView {
    const markPrice = getMarkPrice(this.orderbooks.get(pos.market));
    return {
      positionId: pos.positionId,
      market: pos.market,
      side: pos.side,
      qty: pos.qty,
      margin: pos.margin.toString(),
      leverage: pos.leverage,
      averagePrice: pos.averagePrice.toString(),
      liquidationPrice: pos.liquidationPrice.toString(),
      markPrice: markPrice.toString(),
      unrealisedPnl: pos.computeUnrealizedPnl(markPrice).toString(),
    };
  }
}
