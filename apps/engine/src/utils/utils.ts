import {
  OrderSide,
  PLATFORM_RISK_DENOMINATOR,
  PLATFORM_RISK_NUMERATOR,
} from "@repo/schema";
import { mulDiv } from "./math";

export function getOppositeSide(side: OrderSide): OrderSide {
  return side === "LONG" ? "SHORT" : "LONG";
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
