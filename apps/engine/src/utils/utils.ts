import {
  OrderSide,
  PLATFORM_RISK_DENOMINATOR,
  PLATFORM_RISK_NUMERATOR,
} from "@repo/schema";
import { mulDiv } from "./math";

export function getOppositeSide(side: OrderSide): OrderSide {
  return side === "LONG" ? "SHORT" : "LONG";
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
