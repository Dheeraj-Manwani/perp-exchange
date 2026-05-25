import {
  Fill,
  MAKER_FEE_RATE,
  MakerFillEvent,
  MatchParams,
  OrderFill,
  OrderSide,
  TAKER_FEE_RATE,
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

  match(params: MatchParams, orderbook: Orderbook, taker: Account) {
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

    const levels = orderbook.levelsToMatch(side);

    for (const [levelPrice, _level] of levels) {
      if (remaining === 0) break;

      // checking if best price in book is acceptable
      const crosses =
        side === "long" ? levelPrice <= limitPrice : levelPrice >= limitPrice;
      if (!crosses) break;

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
        if (!isLiquidation) {
          this.applyFillToTaker({
            userId,
            positionId,
            orderId,
            symbol,
            side,
            leverage,
            fillPrice,
            fillQty,
            taker,
            isLimitOrder: type === "limit",
          });

          takerFills.push({
            fillId: uuid(),
            price: fillPrice,
            qty: fillQty,
            fee: mulDiv([fillPrice, fillQty, TAKER_FEE_RATE]),
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

          const makerFee = mulDiv([fillPrice, fillQty, MAKER_FEE_RATE]);
          makerFills.push({
            orderId: cf.makerOrderId,
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
  }): void {
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

    const fillMargin = mulDiv([fillPrice, fillQty], [leverage], "UP");
    const takerFee = mulDiv([fillPrice, fillQty, TAKER_FEE_RATE]);

    taker.consumeLockedMargin(fillMargin);
    taker.debitAvailable(takerFee);

    const fill: Fill = {
      fillId: uuid(),
      orderId,
      price: fillPrice,
      qty: fillQty,
    };
    const existing = this.positions.get(userId, symbol);

    // No existing position, or same direction
    if (!existing || existing.side === side) {
      if (existing) {
        existing.applyFill(fill, fillMargin);
      } else {
        this.positions.add(
          new Position({
            positionId,
            userId,
            market: symbol,
            orderType: isLimitOrder ? "limit" : "market",
            side,
            qty: fillQty,
            margin: fillMargin,
            leverage,
            averagePrice: fillPrice,
            fills: [fill],
          }),
        );
      }
      return;
    }
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
    const fee = mulDiv([fillPrice, fillQty, TAKER_FEE_RATE]);

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
          orderType: "limit",
          side,
          qty: fillQty,
          margin: fillMargin,
          leverage,
          averagePrice: fillPrice,
          fills: [fill],
        }),
      );
    }
  }
}
