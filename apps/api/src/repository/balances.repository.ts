import { prisma } from "@repo/db";

export const createBalanceAccount = async (
  userId: string,
  asset: string = "USD",
  available: bigint = 0n,
  locked: bigint = 0n,
) => {
  await prisma.balance.create({
    data: {
      userId,
      asset,
      availableBalance: available.toString(),
      lockedBalance: locked.toString(),
    },
  });
};
