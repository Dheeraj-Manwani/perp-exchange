import { prisma } from "@repo/db";
import { FundingSettleEngineResponse } from "@repo/schema";
import { claimEvent } from "../lib/idempotency";

export const processFundingSettlement = async (
  data: FundingSettleEngineResponse,
  sourceEventId: string,
): Promise<void> => {
  const totalPayments = data.markets.reduce((n, m) => n + m.payments.length, 0);
  if (totalPayments === 0) return;

  // Pre-build userId → availableBalance map from the engine's balance snapshots
  const balanceAfterMap = new Map(
    data.balanceSnapshots.map((s) => [s.userId, s.available]),
  );

  await prisma.$transaction(async (tx) => {
    // sourceEventId is the Redis stream message ID; period is used as a
    // human-readable label in logs but the stream ID is the idempotency key.
    if (!(await claimEvent(tx, sourceEventId))) return;

    const transactionRows = data.markets.flatMap((m) =>
      m.payments.map((p) => ({
        userId: p.userId,
        type: "FUNDING" as const,
        asset: "USD",
        // Negative amount = paid by the user; positive = received by the user
        amount:
          p.direction === "PAID" ? `-${p.payment}` : p.payment,
        balanceAfter: balanceAfterMap.get(p.userId) ?? "0",
      })),
    );

    await tx.transaction.createMany({ data: transactionRows });

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
