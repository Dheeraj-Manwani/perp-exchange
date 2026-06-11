import {
  FUNDING_BPS_DENOMINATOR,
  FundingPaymentRecord,
  FundingSettleEngineResponse,
} from "@repo/schema";
import { mulDiv } from "../utils/math";
import { OrderbookRegistry } from "./OrderbookRegistry";
import { PositionManager } from "./PositionManager";
import { UserRegistry } from "./UserRegistry";

export class FundingEngine {
  constructor(
    private readonly users: UserRegistry,
    private readonly positions: PositionManager,
    private readonly orderbooks: OrderbookRegistry,
  ) {}

  settle(period: string): FundingSettleEngineResponse {
    const affectedUserIds = new Set<string>();
    const marketResults: FundingSettleEngineResponse["markets"] = [];

    for (const [market, orderbook] of this.orderbooks.entries()) {
      const rateBps = orderbook.computeAndResetFundingRate();
      const markPrice =
        orderbook.lastTradedPrice > 0n
          ? orderbook.lastTradedPrice
          : orderbook.indexPrice;

      if (rateBps === 0n || markPrice === 0n) {
        marketResults.push({
          market,
          fundingRateBps: "0",
          markPrice: markPrice.toString(),
          payments: [],
        });
        continue;
      }

      const payments: FundingPaymentRecord[] = [];
      const absRateBps = rateBps < 0n ? -rateBps : rateBps;

      // rateBps > 0  → mark > index (contango)   → longs pay shorts
      // rateBps < 0  → mark < index (backwardation) → shorts pay longs
      const longPays = rateBps > 0n;

      this.positions.forEachOpen((userId, pos) => {
        if (pos.market !== market) return;

        const account = this.users.getById(userId);
        if (!account) return;

        const payment = mulDiv(
          [BigInt(Math.round(pos.qty)), markPrice, absRateBps],
          [FUNDING_BPS_DENOMINATOR],
        );
        if (payment === 0n) return;

        const userPays = longPays ? pos.side === "LONG" : pos.side === "SHORT";

        if (userPays) {
          account.debitAvailable(payment);
        } else {
          account.creditAvailable(payment);
        }

        affectedUserIds.add(userId);
        payments.push({
          userId,
          market,
          side: pos.side,
          qty: pos.qty,
          markPrice: markPrice.toString(),
          payment: payment.toString(),
          direction: userPays ? "PAID" : "RECEIVED",
        });
      });

      marketResults.push({
        market,
        fundingRateBps: rateBps.toString(),
        markPrice: markPrice.toString(),
        payments,
      });
    }

    const balanceSnapshots = Array.from(affectedUserIds).flatMap((userId) => {
      const account = this.users.getById(userId);
      if (!account) return [];
      const { available, locked } = account.collateral;
      return [{ userId, available: available.toString(), locked: locked.toString() }];
    });

    return { period, markets: marketResults, balanceSnapshots };
  }
}
