import { prisma } from "@repo/db";

export const updateAmountForUser = async (userId: string, amount: bigint) => {
  await prisma.balance.upsert({
    update: {
      availableBalance: {
        increment: amount,
      },
    },
    where: {
      userId_asset: {
        asset: "USD",
        userId,
      },
    },
    create: {
      userId,
      asset: "USD",
      availableBalance: amount,
      lockedBalance: 0,
    },
  });
};
