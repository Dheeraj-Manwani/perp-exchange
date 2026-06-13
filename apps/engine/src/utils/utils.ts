import {
  OrderSide,
  PLATFORM_RISK_DENOMINATOR,
  PLATFORM_RISK_NUMERATOR,
} from "@repo/schema";
import { mulDiv } from "./math";

export function getOppositeSide(side: OrderSide): OrderSide {
  return side === "LONG" ? "SHORT" : "LONG";
}

/**
 * Mark price used for PnL, liquidation triggers and the funding premium.
 * Currently last-traded-price with an index-price fallback — Sprint 10 will
 * replace the body with an index+basis formula, and everything downstream
 * (PnL, liquidations, account summary) inherits it from this single place.
 */
export function getMarkPrice(book: {
  lastTradedPrice: bigint;
  indexPrice: bigint;
}): bigint {
  return book.lastTradedPrice > 0n ? book.lastTradedPrice : book.indexPrice;
}

// compare "<ms>-<seq>" numerically
export function compareStreamIds(a: string, b: string): number {
  const [aMs = 0, aSeq = 0] = a.split("-").map(Number);
  const [bMs = 0, bSeq = 0] = b.split("-").map(Number);
  return aMs !== bMs ? aMs - bMs : aSeq - bSeq;
}

export function getLiquidationPrice(
  entryPrice: bigint,
  leverage: number,
  side: OrderSide,
): bigint {
  const margin = mulDiv([entryPrice], [leverage], "UP");
  const delta = mulDiv(
    [margin, PLATFORM_RISK_NUMERATOR],
    [PLATFORM_RISK_DENOMINATOR],
  );
  return side === "LONG" ? entryPrice - delta : entryPrice + delta;
}
