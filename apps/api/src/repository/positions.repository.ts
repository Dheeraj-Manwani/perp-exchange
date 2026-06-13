import { prisma } from "@repo/db";

const realisedPnlWhere = (userId: string, symbol?: string) => ({
  userId,
  type: "REALISED_PNL" as const,
  ...(symbol ? { market: { symbol } } : {}),
});

const select = {
  id: true,
  amount: true,
  balanceAfter: true,
  referenceId: true,
  createdAt: true,
  market: { select: { symbol: true } },
} as const;

export const findPositionHistory = async (
  userId: string,
  symbol: string | undefined,
  limit: number,
  page: number,
) => {
  return prisma.transaction.findMany({
    where: realisedPnlWhere(userId, symbol),
    select,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });
};

export const countPositionHistory = async (userId: string, symbol?: string) => {
  return prisma.transaction.count({ where: realisedPnlWhere(userId, symbol) });
};
