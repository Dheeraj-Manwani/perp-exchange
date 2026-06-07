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
          where: { asset: "USD" },
        },
      },
    }),
    prisma.market.findMany({
      select: {
        id: true,
        symbol: true,
        decimals: true,
      },
      where: {
        isActive: true,
      },
    }),
  ]);

  existingUsers = dbUsers.map((us) => {
    const usd = us.balances[0];
    return {
      userId: us.id,
      username: us.username,
      available: usd ? BigInt(usd.availableBalance) : undefined,
      locked: usd ? BigInt(usd.lockedBalance) : undefined,
    };
  });

  existingMarkets = dbMarkets.map((m) => m.symbol);
};
