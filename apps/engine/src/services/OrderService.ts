import {
  CancelOrderEngineResponse,
  CreateOrderEngineResponse,
  MakerFillEvent,
  OrderInput,
  OrderSide,
} from "@repo/schema";
import { UserRegistry } from "../core/UserRegistry";
import { Account } from "../core/Account";
import { OrderbookRegistry } from "../core/OrderbookRegistry";
import { mulDiv } from "./../utils/math";
import { MatchingEngine } from "../core/MatchingEngine";
import { PositionManager } from "../core/PositionManager";
import { v4 as uuid } from "uuid";
import { getOppositeSide } from "../utils/utils";

export class OrderService {
  private readonly matching: MatchingEngine;

  constructor(
    private readonly users: UserRegistry,
    private readonly orderbooks: OrderbookRegistry,
    private readonly positions: PositionManager,
  ) {
    this.matching = new MatchingEngine(users, positions);
  }

  placeOrder(userId: string, input: OrderInput) {
    const account = this.users.getById(userId);
    if (!account) throw new Error("User not found");

    let netQty = input.qty;

    const existingPosition = this.positions.get(userId, input.symbol);
    if (
      existingPosition &&
      existingPosition.side === getOppositeSide(input.side)
    ) {
      input.isReduceOnly = true;
      netQty = Math.max(input.qty - existingPosition.qty, 0);
    }

    if (input.leverage > account.maxLeverage)
      throw new Error("Leverage not acceptable");

    const estimatedMargin = mulDiv(
      [input.price, netQty, 10000n + input.slippage],
      [input.leverage, 10000n],
      "UP",
    );

    account.assertSufficientMargin(estimatedMargin);
    account.lockMargin(estimatedMargin);

    return input.type === "MARKET"
      ? this.placeMarketOrder(userId, account, input, estimatedMargin)
      : this.placeLimitOrder(userId, account, input);
  }

  placeMarketOrder(
    userId: string,
    account: Account,
    input: OrderInput,
    estimatedMargin: bigint,
  ): CreateOrderEngineResponse {
    const orderbook = this.orderbooks.get(input.symbol);

    const orderId = uuid();
    const positionId = uuid();

    const result = this.matching.match(
      {
        orderId,
        positionId,
        userId,
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        qty: input.qty,
        leverage: input.leverage,
        limitPrice:
          input.side === "LONG"
            ? (input.price * (10000n + input.slippage)) / 10000n
            : (input.price * (10000n - input.slippage)) / 10000n,
        isLiquidation: false,
      },
      orderbook,
      account,
    );

    // releasing balance for unfilled
    if (result.unfilled > 0 && input.qty > 0) {
      const unfilledMargin = mulDiv(
        [estimatedMargin, result.unfilled],
        [input.qty],
      );
      account.unlockMargin(unfilledMargin);
    }

    const status =
      result.filledQty >= input.qty
        ? "FILLED"
        : result.filledQty > 0
          ? "PARTIALLY_FILLED"
          : "OPEN";

    const avgFillPrice =
      result.filledQty > 0
        ? mulDiv([result.fillValue], [result.filledQty])
        : 0n;

    return {
      orderId,
      symbol: input.symbol,
      type: input.type,
      side: input.side,
      qty: input.qty,
      price: input.price.toString(),
      slippage: input.slippage.toString(),
      leverage: input.leverage,
      isReduceOnly: input.isReduceOnly,
      filledQty: result.filledQty,
      unfilled: result.unfilled,
      avgFillPrice: avgFillPrice.toString(),
      status,
      fills: result.makerFills.map((mf) => ({
        makerOrderId: mf.orderId,
        makerUserId: mf.makerUserId,
        price: mf.fillPrice.toString(),
        qty: mf.fillQty,
      })),
    };
  }

  placeLimitOrder(
    userId: string,
    account: Account,
    input: OrderInput,
  ): CreateOrderEngineResponse {
    const orderId = uuid();
    const positionId = uuid();
    const orderbook = this.orderbooks.get(input.symbol);

    const result = this.matching.match(
      {
        orderId,
        positionId,
        userId,
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        qty: input.qty,
        leverage: input.leverage,
        limitPrice: input.price,
        isLiquidation: false,
      },
      orderbook,
      account,
    );

    // refund margin if filled at a better price than the limit
    if (result.filledQty > 0) {
      const nominalFilledMargin = mulDiv(
        [input.price, result.filledQty],
        [input.leverage],
        "UP",
      );
      const actualFilledMargin = mulDiv(
        [result.fillValue],
        [input.leverage],
        "DOWN",
      );

      const excess = nominalFilledMargin - actualFilledMargin;
      if (excess > 0n) {
        account.unlockMargin(excess);
      }
    }

    // Adding pending qty to orderbook
    if (result.unfilled > 0) {
      orderbook.addLimitOrder(
        {
          orderId,
          userId,
          qty: result.unfilled,
          filledQty: 0,
          leverage: input.leverage,
          createdAt: new Date(),
        },
        input.side,
        input.price,
      );
    }

    const status =
      result.unfilled === 0
        ? "FILLED"
        : result.filledQty > 0
          ? "PARTIALLY_FILLED"
          : "OPEN";

    const avgFillPrice =
      result.filledQty > 0
        ? mulDiv([result.fillValue], [result.filledQty])
        : 0n;

    return {
      orderId,
      symbol: input.symbol,
      type: input.type,
      side: input.side,
      qty: input.qty,
      price: input.price.toString(),
      slippage: input.slippage.toString(),
      leverage: input.leverage,
      isReduceOnly: input.isReduceOnly,
      filledQty: result.filledQty,
      unfilled: result.unfilled,
      avgFillPrice: avgFillPrice.toString(),
      status,
      fills: result.makerFills.map((mf) => ({
        makerOrderId: mf.orderId,
        makerUserId: mf.makerUserId,
        price: mf.fillPrice.toString(),
        qty: mf.fillQty,
      })),
    };
  }

  cancelOrder(
    userId: string,
    orderId: string,
    symbol: string,
    side: OrderSide,
  ): CancelOrderEngineResponse {
    const account = this.users.getById(userId);
    if (!account) throw new Error("User not found");

    const orderbook = this.orderbooks.get(symbol);
    const found = orderbook.cancelOrder(orderId, side);
    if (!found) throw new Error("Order not found or already filled");

    const releasedMargin =
      found.remainingQty > 0
        ? mulDiv([found.price, found.remainingQty], [found.leverage], "UP")
        : 0n;

    account.unlockMargin(releasedMargin);

    return { orderId, releasedMargin: releasedMargin.toString() };
  }
}
