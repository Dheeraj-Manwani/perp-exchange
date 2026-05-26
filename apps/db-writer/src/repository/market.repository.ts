import { prisma } from "@repo/db";

export const getMarketBySymbol = async (symbol: string) => {
  return await prisma.market.findUnique({
    where: {
      symbol,
    },
  });
};
