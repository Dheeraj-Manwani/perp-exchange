import { prisma } from "@repo/db";

export let existingMarkets: string[] = [];

export const fetchLastState = async () => {
  const dbMarkets = await prisma.market.findMany({
    select: {
      id: true,
      symbol: true,
      decimals: true,
    },
    where: {
      isActive: true,
    },
  });

  existingMarkets = dbMarkets.map((m) => m.symbol);
};
