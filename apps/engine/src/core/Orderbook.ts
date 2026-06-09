import {
  CancelledOrder,
  ConsumedFill,
  FUNDING_BPS_DENOMINATOR,
  FUNDING_RATE_CAP_BPS,
  OpenOrder,
  OrderSide,
} from "@repo/schema";
import { mulDiv } from "../utils/math";
import { PriceLevel } from "./PriceLevel";

export class Orderbook {
  readonly asset: string;
  lastTradedPrice: bigint = 0n;
  indexPrice: bigint = 0n;

  // Funding-rate accumulator: tracks time-weighted premium index in bps×ms
  private _premiumBpsAccum: bigint = 0n;
  private _fundingWindowStart: number = Date.now();
  private _lastFundingUpdateAt: number = Date.now();

  asks: Map<string, PriceLevel> = new Map();
  bids: Map<string, PriceLevel> = new Map();

  constructor(asset: string) {
    this.asset = asset;
  }

  /**
   * Called on every index price tick. Advances the TWAP accumulator using
   * the time elapsed since the last update and the current premium (mark vs index).
   * Uses lastTradedPrice as mark price when available, falls back to indexPrice.
   */
  updateFundingAccumulator(indexPrice: bigint): void {
    if (indexPrice === 0n) return;
    const now = Date.now();
    const elapsedMs = BigInt(now - this._lastFundingUpdateAt);
    if (elapsedMs > 0n) {
      const markPrice =
        this.lastTradedPrice > 0n ? this.lastTradedPrice : indexPrice;
      const premium = markPrice - indexPrice;
      this._premiumBpsAccum += mulDiv(
        [premium, FUNDING_BPS_DENOMINATOR, elapsedMs],
        [indexPrice],
      );
    }
    this._lastFundingUpdateAt = now;
  }

  /**
   * Computes the time-weighted average funding rate for the current window,
   * clamps it to ±FUNDING_RATE_CAP_BPS, then resets the accumulator for the
   * next period. Returns the rate in signed basis points.
   */
  computeAndResetFundingRate(): bigint {
    const now = Date.now();
    const totalMs = BigInt(now - this._fundingWindowStart);

    let rateBps = 0n;
    if (totalMs > 0n) {
      const twapBps = this._premiumBpsAccum / totalMs;
      if (twapBps > FUNDING_RATE_CAP_BPS) {
        rateBps = FUNDING_RATE_CAP_BPS;
      } else if (twapBps < -FUNDING_RATE_CAP_BPS) {
        rateBps = -FUNDING_RATE_CAP_BPS;
      } else {
        rateBps = twapBps;
      }
    }

    this._premiumBpsAccum = 0n;
    this._fundingWindowStart = now;
    this._lastFundingUpdateAt = now;

    return rateBps;
  }

  levelsToMatch(takerSide: OrderSide): Array<[bigint, PriceLevel]> {
    return takerSide === "LONG"
      ? [...this.asks.values()]
          .filter((l) => !l.isEmpty())
          .sort((a, b) => (a.price - b.price > 0n ? 1 : -1))
          .map((l) => [l.price, l] as [bigint, PriceLevel])
      : [...this.bids.values()]
          .filter((l) => !l.isEmpty())
          .sort((a, b) => (b.price - a.price > 0n ? 1 : -1))
          .map((l) => [l.price, l] as [bigint, PriceLevel]);
  }

  consumeAtLevel(
    takerSide: OrderSide,
    price: bigint,
    qty: number,
    skipUserId?: string,
  ): ConsumedFill[] {
    const map = takerSide === "LONG" ? this.asks : this.bids;
    const level = map.get(String(price));
    if (!level) return [];

    const fills = level.consume(qty, skipUserId);
    if (level.isEmpty()) map.delete(String(price));
    return fills;
  }

  cancelOrder(
    orderId: string,
    side: OrderSide,
  ): { price: bigint; remainingQty: number; leverage: number } | null {
    const map = side === "LONG" ? this.bids : this.asks;
    for (const [key, level] of map) {
      const result = level.cancelOrder(orderId);
      if (result !== null) {
        if (level.isEmpty()) map.delete(key);
        return { price: level.price, ...result };
      }
    }
    return null;
  }

  addLimitOrder(order: OpenOrder, side: OrderSide, price: bigint): void {
    const map = side === "LONG" ? this.bids : this.asks;
    const key = String(price);
    let level = map.get(key);
    if (!level) {
      level = new PriceLevel(price);
      map.set(key, level);
    }
    level.addOrder(order);
  }

  cancelUserOrders(userId: string): CancelledOrder[] {
    const cancelled: CancelledOrder[] = [];

    const emptyBidKeys: string[] = [];
    for (const [priceStr, level] of this.bids) {
      const removed = level.removeUserOrders(userId);
      for (const o of removed) {
        cancelled.push({
          orderId: o.orderId,
          userId: o.userId,
          unfilledQty: o.qty - o.filledQty,
          price: BigInt(priceStr),
          leverage: o.leverage,
        });
      }
      if (level.isEmpty()) emptyBidKeys.push(priceStr);
    }
    for (const key of emptyBidKeys) this.bids.delete(key);

    const emptyAskKeys: string[] = [];
    for (const [priceStr, level] of this.asks) {
      const removed = level.removeUserOrders(userId);
      for (const o of removed) {
        cancelled.push({
          orderId: o.orderId,
          userId: o.userId,
          unfilledQty: o.qty - o.filledQty,
          price: BigInt(priceStr),
          leverage: o.leverage,
        });
      }
      if (level.isEmpty()) emptyAskKeys.push(priceStr);
    }
    for (const key of emptyAskKeys) this.asks.delete(key);

    return cancelled;
  }

  serialise() {
    return {
      asset: this.asset,
      lastTradedPrice: this.lastTradedPrice,
      indexPrice: this.indexPrice,
      _premiumBpsAccum: this._premiumBpsAccum,
      _fundingWindowStart: this._fundingWindowStart,
      _lastFundingUpdateAt: this._lastFundingUpdateAt,
      asks: Array.from(this.asks).map(
        (ask) => [ask[0], ask[1].serialise()] as const,
      ),
      bids: Array.from(this.bids).map(
        (bid) => [bid[0], bid[1].serialise()] as const,
      ),
    };
  }

  static fromSerialised(data: ReturnType<Orderbook["serialise"]>): Orderbook {
    const book = new Orderbook(data.asset);
    book.lastTradedPrice = data.lastTradedPrice;
    book.indexPrice = data.indexPrice;
    book._premiumBpsAccum = data._premiumBpsAccum ?? 0n;
    book._fundingWindowStart = data._fundingWindowStart ?? Date.now();
    book._lastFundingUpdateAt = data._lastFundingUpdateAt ?? Date.now();
    book.asks = new Map(
      data.asks.map(([price, level]) => [
        price,
        PriceLevel.fromSerialised(level),
      ]),
    );
    book.bids = new Map(
      data.bids.map(([price, level]) => [
        price,
        PriceLevel.fromSerialised(level),
      ]),
    );
    return book;
  }
}
