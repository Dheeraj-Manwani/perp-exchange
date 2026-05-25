import { MakerFillEvent, OrderInput } from "@repo/schema";
import { UserRegistry } from "../core/UserRegistry";
import { Account } from "../core/Account";
import { OrderbookRegistry } from "../core/OrderbookRegistry";
import { mulDiv } from "./../utils/math";
import { MatchingEngine } from "../core/MatchingEngine";
import { PositionManager } from "../core/PositionManager";
import { v4 as uuid } from "uuid";
import { OrderStatus } from "@repo/db";

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

    // TODO: implement reduce only orders
    if (input.leverage > account.maxLeverage)
      throw new Error("Leverage not acceptable");

    const estimatedMargin = mulDiv(
      [input.price, input.qty, 1n + input.slippage / 10000n],
      [],
      "UP",
    );

    // TODO: better error catching requried
    account.assertSufficientMargin(estimatedMargin);
    account.lockMargin(estimatedMargin);

    return input.type === "market"
      ? this.placeMarketOrder(userId, account, input)
      : this.placeLimitOrder(userId, account, input);
  }

  placeMarketOrder(userId: string, account: Account, input: OrderInput) {
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
        limitPrice: input.price,
        isLiquidation: false,
      },
      orderbook,
      account,
    );

    const status: OrderStatus =
      result.filledQty >= input.qty
        ? "FILLED"
        : result.filledQty > 0
          ? "PARTIALLY_FILLED"
          : "OPEN";

    const avgFillPrice =
      result.filledQty > 0 ? mulDiv([result.fillValue], [result.filledQty]) : 0;

    // TODO: make the db poller save and update orders
    // this.orders.push({
    //   orderId,
    //   positionId,
    //   userId,
    //   market: input.symbol,
    //   side: input.side,
    //   type: "market",
    //   qty: input.qty,
    //   status,
    //   leverage: input.leverage,
    //   createdAt: Date.now(),
    //   filledQty: result.filledQty,
    //   remainingQty: result.unfilled,
    //   avgFillPrice,
    //   fills: result.takerFills,
    // });

    // TODO: make the db poller save and update orders
    this.updateMakerOrders(result.makerFills);

    return {
      success: true,
      orderId,
      filledQty: result.filledQty,
      unfilled: result.unfilled,
      avgFillPrice,
    };
  }
  placeLimitOrder(userId: string, account: Account, input: OrderInput) {
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

    // refunding amount if got fills at better price
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
      if (excess > 0) {
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

    const status: OrderStatus =
      result.unfilled === 0
        ? "filled"
        : result.filledQty > 0
          ? "partially_filled"
          : "open";

    const avgFillPrice =
      result.filledQty > 0 ? mulDiv([result.fillValue], [result.filledQty]) : 0;

    // TODO: make the db poller save and update orders
    // this.orders.push({
    //   orderId,
    //   positionId,
    //   userId,
    //   market: input.symbol,
    //   side: input.side,
    //   type: "limit",
    //   qty: input.qty,
    //   price: input.price,
    //   status,
    //   leverage: input.leverage,
    //   createdAt: Date.now(),
    //   filledQty: result.filledQty,
    //   remainingQty: result.unfilled,
    //   avgFillPrice,
    //   fills: result.takerFills,
    // });

    // TODO: make the db poller save and update orders
    this.updateMakerOrders(result.makerFills);

    return {
      success: true,
      orderId,
      filledQty: result.filledQty,
      unfilled: result.unfilled,
      avgFillPrice,
    };
  }

  private updateMakerOrders(makerFills: MakerFillEvent[]): void {
    for (const mf of makerFills) {
      const record = this.orders.find((o) => o.orderId === mf.orderId);
      if (!record) continue;

      record.fills.push({
        fillId: uuid(),
        qty: mf.fillQty,
        price: mf.fillPrice,
        fee: mf.fee,
        role: "maker",
        timestamp: mf.timestamp,
      });
      record.filledQty += mf.fillQty;
      record.remainingQty = Math.max(0, record.remainingQty - mf.fillQty);
      record.avgFillPrice =
        record.fills.reduce((s, f) => s + f.price * f.qty, 0) /
        record.filledQty;
      record.status =
        record.remainingQty < 1e-10 ? "filled" : "partially_filled";
    }
  }
}
