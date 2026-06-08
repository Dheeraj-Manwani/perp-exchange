import { prisma } from "@repo/db";
import { claimEvent } from "../lib/idempotency";

export const updateAmountForUser = async (
  userId: string,
  amount: bigint,
  sourceEventId: string,
) => {
  await prisma.$transaction(async (tx) => {
    if (!(await claimEvent(tx, sourceEventId))) return;

    const existing = await tx.balance.findUnique({
      where: { userId_asset: { userId, asset: "USD" } },
      select: { availableBalance: true },
    });

    const newAvailable = existing
      ? (BigInt(existing.availableBalance) + amount).toString()
      : amount.toString();

    await tx.balance.upsert({
      where: { userId_asset: { userId, asset: "USD" } },
      update: { availableBalance: newAvailable },
      create: {
        userId,
        asset: "USD",
        availableBalance: newAvailable,
        lockedBalance: "0",
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        asset: "USD",
        amount: amount.toString(),
        balanceAfter: newAvailable,
      },
    });
  });
};
