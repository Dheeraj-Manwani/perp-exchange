import { Fill, OrderSide, PLATFORM_RISK_ADJUSTMENT } from "@repo/schema";
import { mulDiv } from "./math";

export function getOppositeSide(side: OrderSide): OrderSide {
  return side === "long" ? "short" : "long";
}

export function getLiquidationPrice(
  entryPrice: bigint,
  leverage: number,
  side: OrderSide,
): bigint {
  const margin = mulDiv([entryPrice], [leverage], "UP");
  const delta = mulDiv([margin, 1 - PLATFORM_RISK_ADJUSTMENT]);
  return side === "long" ? entryPrice - delta : entryPrice + delta;
}

export function computeWeightedAveragePrice(fills: Fill[]): bigint {
  let totalValue = 0n;
  let totalQty = 0;
  for (const f of fills) {
    totalValue += mulDiv([f.price, f.qty]);
    totalQty += f.qty;
  }
  return totalQty < 0.01 ? 0n : mulDiv([totalValue], [totalQty]);
}
