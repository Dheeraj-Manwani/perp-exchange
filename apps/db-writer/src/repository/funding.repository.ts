import { prisma } from "@repo/db";
import { FundingSettleEngineResponse } from "@repo/schema";
import { claimEvent } from "../lib/idempotency";

export const processFundingSettlement = async (
  data: FundingSettleEngineResponse,
  sourceEventId: string,
): Promise<void> => {
  const marketRows = await prisma.market.findMany({
    where: { symbol: { in: data.markets.map((m) => m.market) } },
    select: { id: true, symbol: true },
  });
  const marketIdBySymbol = new Map(marketRows.map((m) => [m.symbol, m.id]));

  // Pre-build userId → availableBalance map from the engine's balance snapshots
  const balanceAfterMap = new Map(
    data.balanceSnapshots.map((s) => [s.userId, s.available]),
  );

  await prisma.$transaction(async (tx) => {
    // sourceEventId is the Redis stream message ID; period is used as a
    // human-readable label in logs but the stream ID is the idempotency key.
    if (!(await claimEvent(tx, sourceEventId))) return;

    // One funding-rate row per market per period, even when no positions paid —
    // this is what serves GET /markets/:symbol/funding-rate[/history].
    const fundingRateRows = data.markets.flatMap((m) => {
      const marketId = marketIdBySymbol.get(m.market);
      if (!marketId) return [];
      return [
        {
          marketId,
          period: data.period,
          rateBps: m.fundingRateBps,
          markPrice: m.markPrice,
          settledAt: new Date(data.period),
        },
      ];
    });

    if (fundingRateRows.length > 0) {
      // skipDuplicates guards the (marketId, period) unique key in case the
      // same period arrives under a different stream ID
      await tx.fundingRate.createMany({
        data: fundingRateRows,
        skipDuplicates: true,
      });
    }

    const transactionRows = data.markets.flatMap((m) =>
      m.payments.map((p) => ({
        userId: p.userId,
        type: "FUNDING" as const,
        asset: "USD",
        // Negative amount = paid by the user; positive = received by the user
        amount: p.direction === "PAID" ? `-${p.payment}` : p.payment,
        balanceAfter: balanceAfterMap.get(p.userId) ?? "0",
      })),
    );

    if (transactionRows.length > 0) {
      await tx.transaction.createMany({ data: transactionRows });
    }

    for (const snap of data.balanceSnapshots) {
      await tx.balance.updateMany({
        where: { userId: snap.userId, asset: "USD" },
        data: {
          availableBalance: snap.available,
          lockedBalance: snap.locked,
        },
      });
    }
  });
};
