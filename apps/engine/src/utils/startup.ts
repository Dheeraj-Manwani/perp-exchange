import { prisma } from "@repo/db";
import { AccountParams } from "@repo/schema";

export let existingUsers: AccountParams[] = [];
export let existingMarkets: string[] = [];

export const fetchLastState = async () => {
  const [dbUsers, dbMarkets] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        balances: {
          select: { asset: true, availableBalance: true, lockedBalance: true },
        },
      },
      where: {
        balances: {
          every: {
            asset: "USD",
          },
        },
      },
    }),
    prisma.market.findMany({
      select: {
        id: true,
        symbol: true,
      },
      where: {
        isActive: true,
      },
    }),
  ]);

  existingUsers = dbUsers.map((us) => ({
    userId: us.id,
    username: us.username,
    available: us.balances[0]?.availableBalance,
    locked: us.balances[0]?.lockedBalance,
  }));

  existingMarkets = dbMarkets.map((m) => m.symbol);
};
