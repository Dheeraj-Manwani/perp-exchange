import { ConsumedFill, OpenOrder, OrderSide } from "@repo/schema";
import { PriceLevel } from "./PriceLevel";

export class Orderbook {
  readonly asset: string;
  lastTradedPrice: bigint = 0n;
  indexPrice: number = 0;

  asks: Map<string, PriceLevel> = new Map();
  bids: Map<string, PriceLevel> = new Map();

  constructor(asset: string) {
    this.asset = asset;
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
}
