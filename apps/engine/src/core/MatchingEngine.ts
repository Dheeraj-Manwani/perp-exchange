import {
  Fill,
  FEE_DENOMINATOR,
  MAKER_FEE_NUMERATOR,
  MakerFillEvent,
  MatchParams,
  OrderFill,
  OrderSide,
  TAKER_FEE_NUMERATOR,
} from "@repo/schema";
import { PositionManager } from "./PositionManager";
import { UserRegistry } from "./UserRegistry";
import { Orderbook } from "./Orderbook";
import { Account } from "./Account";
import { mulDiv } from "../utils/math";
import { v4 as uuid } from "uuid";
import { Position } from "./Position";
import { getOppositeSide } from "../utils/utils";

export class MatchingEngine {
  constructor(
    private readonly users: UserRegistry,
    private readonly positions: PositionManager,
  ) {}

  match(params: MatchParams, orderbook: Orderbook, taker?: Account) {
    const {
      orderId,
      positionId,
      userId,
      symbol,
      side,
      type,
      qty,
      leverage,
      limitPrice,
      isLiquidation,
    } = params;

    const takerFills: OrderFill[] = [];
    const makerFills: MakerFillEvent[] = [];
    let remaining = qty;
    let filledQty = 0;
    let fillValue = 0n;
    let takerMarginConsumed = 0n;

    const levels = orderbook.levelsToMatch(side);

    for (const [levelPrice, _level] of levels) {
      if (remaining === 0) break;

      // checking if best price in book is acceptable - for non liquidation
      if (!isLiquidation) {
        const crosses =
          side === "LONG" ? levelPrice <= limitPrice : levelPrice >= limitPrice;
        if (!crosses) break;
      }

      const consumed = orderbook.consumeAtLevel(
        side,
        levelPrice,
        remaining,
        userId,
      );

      for (const cf of consumed) {
        const fillQty = cf.qty;
        const fillPrice = levelPrice;
        const fillTimestamp = Date.now();

        // taker fills
        if (!isLiquidation && taker) {
          takerMarginConsumed += this.applyFillToTaker({
            userId,
            positionId,
            orderId,
            symbol,
            side,
            leverage,
            fillPrice,
            fillQty,
            taker,
            isLimitOrder: type === "LIMIT",
          });

          takerFills.push({
            fillId: uuid(),
            price: fillPrice,
            qty: fillQty,
            fee: mulDiv(
              [fillPrice, fillQty, TAKER_FEE_NUMERATOR],
              [FEE_DENOMINATOR],
            ),
            role: "taker",
            timestamp: fillTimestamp,
          });
        }

        // maker fills
        const makerAccount =
          cf.makerUserId !== userId
            ? this.users.getById(cf.makerUserId)
            : undefined;
        if (makerAccount) {
          this.applyFillToMaker({
            userId: cf.makerUserId,
            orderId: cf.makerOrderId,
            symbol,
            side: getOppositeSide(side),
            leverage: cf.makerLeverage,
            fillPrice,
            fillQty,
            makerAccount,
          });

          const makerFee = mulDiv(
            [fillPrice, fillQty, MAKER_FEE_NUMERATOR],
            [FEE_DENOMINATOR],
          );
          makerFills.push({
            orderId: cf.makerOrderId,
            makerUserId: cf.makerUserId,
            fillQty,
            fillPrice,
            fee: makerFee,
            timestamp: fillTimestamp,
          });
        }

        filledQty += fillQty;
        fillValue += mulDiv([fillPrice, fillQty]);
        remaining -= fillQty;
        orderbook.lastTradedPrice = fillPrice;
      }
    }

    return {
      filledQty,
      unfilled: remaining,
      fillValue,
      takerFills,
      makerFills,
      takerMarginConsumed,
    };
  }

  private applyFillToTaker(params: {
    userId: string;
    positionId: string;
    orderId: string;
    symbol: string;
    side: OrderSide;
    leverage: number;
    fillPrice: bigint;
    fillQty: number;
    taker: Account;
    isLimitOrder: boolean;
  }): bigint {
    const {
      userId,
      positionId,
      orderId,
      symbol,
      side,
      leverage,
      fillPrice,
      fillQty,
      taker,
      isLimitOrder,
    } = params;

    const fill: Fill = {
      fillId: uuid(),
      orderId,
      price: fillPrice,
      qty: fillQty,
    };
    const existing = this.positions.get(userId, symbol);

    // No existing position, or same direction
    if (!existing || existing.side === side) {
      // consuming full margin for same side existing / new orders
      const fillMargin = mulDiv([fillPrice, fillQty], [leverage], "UP");
      const takerFee = mulDiv(
        [fillPrice, fillQty, TAKER_FEE_NUMERATOR],
        [FEE_DENOMINATOR],
      );

      taker.consumeLockedMargin(fillMargin);
      taker.debitAvailable(takerFee);

      if (existing) {
        existing.applyFill(fill, fillMargin);
      } else {
        this.positions.add(
          new Position({
            positionId,
            userId,
            market: symbol,
            orderType: isLimitOrder ? "LIMIT" : "MARKET",
            side,
            qty: fillQty,
            margin: fillMargin,
            leverage,
            averagePrice: fillPrice,
          }),
        );
      }
      return fillMargin;
    }

    // closing opposite positions and opening new
    const closeQty = Math.min(fillQty, existing.qty);
    const openQty = fillQty - closeQty;

    const priceDelta =
      existing.side === "LONG"
        ? fillPrice - existing.averagePrice
        : existing.averagePrice - fillPrice;
    const realizedPnl = mulDiv([priceDelta, closeQty]);

    const { closedMargin } = existing.reduceBy(closeQty, fillPrice);
    const proceeds = closedMargin + realizedPnl;
    if (proceeds > 0) {
      taker.creditAvailable(proceeds);
    }

    // Flip: if the fill exceeds the existing position, open a new one in the new direction.
    if (openQty > 0) {
      const openFillMargin = mulDiv([openQty, fillPrice], [leverage], "UP");
      const openTakerFee = mulDiv(
        [openQty, fillPrice, TAKER_FEE_NUMERATOR],
        [FEE_DENOMINATOR],
      );

      taker.consumeLockedMargin(openFillMargin);
      taker.debitAvailable(openTakerFee);

      this.positions.add(
        new Position({
          positionId: uuid(),
          userId,
          market: symbol,
          orderType: isLimitOrder ? "LIMIT" : "MARKET",
          side,
          qty: openQty,
          margin: openFillMargin,
          leverage,
          averagePrice: fillPrice,
        }),
      );
      return openFillMargin;
    }

    return 0n;
  }

  private applyFillToMaker(params: {
    userId: string;
    orderId: string;
    symbol: string;
    side: OrderSide;
    leverage: number;
    fillPrice: bigint;
    fillQty: number;
    makerAccount: Account;
  }): void {
    const {
      userId,
      orderId,
      symbol,
      side,
      leverage,
      fillPrice,
      fillQty,
      makerAccount,
    } = params;

    const fillMargin = mulDiv([fillPrice, fillQty], [leverage], "UP");
    const fee = mulDiv(
      [fillPrice, fillQty, MAKER_FEE_NUMERATOR],
      [FEE_DENOMINATOR],
    );

    makerAccount.consumeLockedMargin(fillMargin);
    makerAccount.debitAvailable(fee);

    const fill: Fill = {
      fillId: uuid(),
      orderId,
      price: fillPrice,
      qty: fillQty,
    };
    const existing = this.positions.get(userId, symbol);

    if (existing) {
      existing.applyFill(fill, fillMargin);
    } else {
      this.positions.add(
        new Position({
          positionId: uuid(),
          userId,
          market: symbol,
          orderType: "LIMIT",
          side,
          qty: fillQty,
          margin: fillMargin,
          leverage,
          averagePrice: fillPrice,
        }),
      );
    }
  }
}
