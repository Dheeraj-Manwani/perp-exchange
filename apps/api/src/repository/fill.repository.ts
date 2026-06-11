import { prisma } from "@repo/db";

// Public trade needs only the aggressor (taker) side for coloring the tape.
const tradeSelect = {
  id: true,
  price: true,
  qty: true,
  createdAt: true,
  takerOrder: { select: { side: true } },
} as const;

// A user fill needs both order sides so the mapper can pick whichever side the
// user was on (taker vs maker), determined by comparing userId per row.
const userFillSelect = {
  id: true,
  takerUserId: true,
  makerUserId: true,
  takerOrderId: true,
  makerOrderId: true,
  price: true,
  qty: true,
  createdAt: true,
  market: { select: { symbol: true } },
  takerOrder: { select: { side: true } },
  makerOrder: { select: { side: true } },
} as const;

export const findRecentTrades = async (marketId: string, limit: number) => {
  return prisma.fill.findMany({
    where: { marketId },
    select: tradeSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

const userFillWhere = (userId: string, marketId?: string) => ({
  OR: [{ takerUserId: userId }, { makerUserId: userId }],
  ...(marketId ? { marketId } : {}),
});

export const findUserFills = async (
  userId: string,
  marketId: string | undefined,
  limit: number,
  page: number,
) => {
  return prisma.fill.findMany({
    where: userFillWhere(userId, marketId),
    select: userFillSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });
};

export const countUserFills = async (
  userId: string,
  marketId?: string,
) => {
  return prisma.fill.count({ where: userFillWhere(userId, marketId) });
};
