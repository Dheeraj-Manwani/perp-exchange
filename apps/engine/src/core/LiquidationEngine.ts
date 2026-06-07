import {
  FEE_DENOMINATOR,
  IndexPriceUpdateEngineResponse,
  LiquidationEventRecord,
  MakerFillEvent,
  OrderSide,
  TAKER_FEE_NUMERATOR,
} from "@repo/schema";
import { logger } from "@repo/logger";
import { mulDiv } from "../utils/math";
import { getOppositeSide } from "../utils/utils";
import { InsuranceFund } from "./InsuranceFund";
import { MatchingEngine } from "./MatchingEngine";
import { OrderbookRegistry } from "./OrderbookRegistry";
import { Position } from "./Position";
import { PositionManager } from "./PositionManager";
import { UserRegistry } from "./UserRegistry";
import { v4 as uuid } from "uuid";

type LiquidateResult = {
  liquidationOrderId: string;
  filledQty: number;
  avgFillPrice: bigint;
  fills: MakerFillEvent[];
  adlTriggered: boolean;
};

export class LiquidationEngine {
  private readonly matching: MatchingEngine;
  constructor(
    private readonly users: UserRegistry,
    private readonly positions: PositionManager,
    private readonly orderbooks: OrderbookRegistry,
    private readonly insurance: InsuranceFund,
  ) {
    this.matching = new MatchingEngine(users, positions);
  }

  onPriceUpdate(market: string, price: bigint): IndexPriceUpdateEngineResponse {
    const orderbook = this.orderbooks.get(market);
    orderbook.indexPrice = price;

    const underwater: Position[] = [];
    this.positions.forEachOpen((userId, pos) => {
      if (pos.market === market && pos.isUnderwater(price)) {
        underwater.push(pos);
      }
    });

    const cancelledOrders: IndexPriceUpdateEngineResponse["cancelledOrders"] =
      [];
    const liquidations: LiquidationEventRecord[] = [];
    const affectedUserIds = new Set<string>();

    for (const pos of underwater) {
      const account = this.users.getById(pos.userId);
      if (!account) continue;

      affectedUserIds.add(pos.userId);

      const cancelled = orderbook.cancelUserOrders(pos.userId);
      for (const c of cancelled) {
        const refund = mulDiv([c.unfilledQty, c.price], [c.leverage]);
        account.unlockMargin(refund);
        cancelledOrders.push({
          orderId: c.orderId,
          userId: pos.userId,
          releasedMargin: refund.toString(),
        });
      }

      const origQty = pos.qty;
      const origSide = pos.side;
      const origLeverage = pos.leverage;

      const result = this.liquidate(pos);

      for (const f of result.fills) {
        affectedUserIds.add(f.makerUserId);
      }

      liquidations.push({
        liquidationOrderId: result.liquidationOrderId,
        positionId: pos.positionId,
        userId: pos.userId,
        market: pos.market,
        side: origSide,
        qty: origQty,
        filledQty: result.filledQty,
        avgFillPrice: result.avgFillPrice.toString(),
        leverage: origLeverage,
        fills: result.fills.map((f) => ({
          makerOrderId: f.orderId,
          makerUserId: f.makerUserId,
          price: f.fillPrice.toString(),
          qty: f.fillQty,
        })),
        adlTriggered: result.adlTriggered,
      });

      this.positions.purge(pos.userId);
    }

    const balanceSnapshots = Array.from(affectedUserIds).flatMap((userId) => {
      const account = this.users.getById(userId);
      if (!account) return [];
      const { available, locked } = account.collateral;
      return [
        { userId, available: available.toString(), locked: locked.toString() },
      ];
    });

    return { cancelledOrders, liquidations, balanceSnapshots };
  }

  liquidate(pos: Position): LiquidateResult {
    const otherSide = getOppositeSide(pos.side);
    const orderbook = this.orderbooks.get(pos.market);
    const orderId = uuid();

    const result = this.matching.match(
      {
        orderId,
        userId: pos.userId,
        positionId: pos.positionId,
        symbol: pos.market,
        qty: pos.qty,
        side: otherSide,
        type: pos.orderType,
        limitPrice: pos.averagePrice,
        leverage: pos.leverage,
        isLiquidation: true,
      },
      orderbook,
    );

    if (result.filledQty === 0) {
      this.triggerADL(pos);
      pos.close();
      return {
        liquidationOrderId: orderId,
        filledQty: 0,
        avgFillPrice: 0n,
        fills: [],
        adlTriggered: true,
      };
    }

    const avgFillPrice = mulDiv([result.fillValue], [result.filledQty]);
    const realizedPnl =
      pos.side === "LONG"
        ? mulDiv([avgFillPrice - pos.averagePrice, result.filledQty])
        : mulDiv([pos.averagePrice - avgFillPrice, result.filledQty]);

    const { closedMargin } = pos.reduceBy(result.filledQty, avgFillPrice);
    this.settleClosedMargin(
      pos.userId,
      closedMargin,
      realizedPnl,
      result.fillValue,
    );

    let adlTriggered = false;
    if (result.unfilled > 0) {
      this.triggerADL({
        positionId: pos.positionId,
        userId: pos.userId,
        market: pos.market,
        side: pos.side,
        qty: result.unfilled,
        margin: pos.margin,
      });
      pos.close();
      adlTriggered = true;
    }

    return {
      liquidationOrderId: orderId,
      filledQty: result.filledQty,
      avgFillPrice,
      fills: result.makerFills,
      adlTriggered,
    };
  }

  private settleClosedMargin(
    userId: string,
    closedMargin: bigint,
    realizedPnl: bigint,
    fillValue: bigint,
  ) {
    const account = this.users.getById(userId);
    if (!account) return;

    const fee = mulDiv([TAKER_FEE_NUMERATOR, fillValue], [FEE_DENOMINATOR]);
    const net = closedMargin + realizedPnl - fee;

    if (net > 0n) {
      account.creditAvailable(net);
    } else {
      this.insurance.absorb(-net);
    }
  }

  triggerADL(pos: {
    positionId: string;
    userId: string;
    market: string;
    side: OrderSide;
    qty: number;
    margin: bigint;
  }) {
    const orderbook = this.orderbooks.get(pos.market);
    const markPrice =
      orderbook.lastTradedPrice > 0n
        ? orderbook.lastTradedPrice
        : orderbook.indexPrice;

    const oppositeSide = getOppositeSide(pos.side);

    const candidates: Array<{
      userId: string;
      position: Position;
      pnlRatio: bigint;
    }> = [];

    this.positions.forEachOpen((userId, openPos) => {
      if (openPos.market !== pos.market) return;
      if (openPos.side !== oppositeSide) return;
      const unrealizedPnl = openPos.computeUnrealizedPnl(markPrice);
      if (unrealizedPnl <= 0n) return;
      candidates.push({
        userId,
        position: openPos,
        pnlRatio: mulDiv([unrealizedPnl], [openPos.margin]),
      });
    });

    candidates.sort((a, b) => (b.pnlRatio - a.pnlRatio > 0n ? 1 : -1));

    let remainingQty = pos.qty;

    for (const { userId, position } of candidates) {
      if (remainingQty < 1e-10) break;

      const closeQty = Math.min(remainingQty, position.qty);
      const { closedMargin } = position.reduceBy(closeQty, markPrice);

      const realizedPnl =
        position.side === "LONG"
          ? mulDiv([markPrice - position.averagePrice, closeQty])
          : mulDiv([position.averagePrice - markPrice, closeQty]);

      const account = this.users.getById(userId);
      if (account) {
        const proceeds = closedMargin + realizedPnl;
        if (proceeds > 0n) account.creditAvailable(proceeds);
      }

      logger.warn(
        `[ADL] Force-closed ${closeQty} of positionId=${position.positionId} ` +
          `userId=${userId} (${position.side} ${pos.market}) at markPrice=${markPrice}`,
      );

      remainingQty -= closeQty;
    }

    if (remainingQty > 1e-10) {
      const proportion = remainingQty / pos.qty;
      const absorbed = mulDiv([pos.margin, proportion]);
      this.insurance.absorb(absorbed);
      logger.warn(
        `[ADL] positionId=${pos.positionId} — ${(proportion * 100).toFixed(2)}% unresolved, ` +
          `absorbed ${absorbed} into insurance fund`,
      );
    }
  }
}
