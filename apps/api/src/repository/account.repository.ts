import { prisma } from "@repo/db";
import { TransactionTypeFilter } from "@repo/schema";

export const findBalances = async (userId: string) => {
  return prisma.balance.findMany({
    where: { userId },
    select: {
      asset: true,
      availableBalance: true,
      lockedBalance: true,
      updatedAt: true,
    },
    orderBy: { asset: "asc" },
  });
};

// Transaction ledger rows carry the optional market dimension so callers can
// render market/period context without a second lookup.
const transactionSelect = {
  id: true,
  type: true,
  asset: true,
  amount: true,
  balanceAfter: true,
  referenceId: true,
  createdAt: true,
  market: { select: { symbol: true } },
} as const;

const transactionWhere = (userId: string, type?: TransactionTypeFilter) => ({
  userId,
  ...(type ? { type } : {}),
});

export const findTransactions = async (
  userId: string,
  type: TransactionTypeFilter | undefined,
  limit: number,
  page: number,
) => {
  return prisma.transaction.findMany({
    where: transactionWhere(userId, type),
    select: transactionSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });
};

export const countTransactions = async (
  userId: string,
  type?: TransactionTypeFilter,
) => {
  return prisma.transaction.count({ where: transactionWhere(userId, type) });
};

// Funding payments are FUNDING-type ledger rows. The optional symbol is a
// filter (like /orders/history), so it filters via the market relation rather
// than 404-ing on an unknown symbol.
const fundingWhere = (userId: string, symbol?: string) => ({
  userId,
  type: "FUNDING" as const,
  ...(symbol ? { market: { symbol } } : {}),
});

export const findFundingPayments = async (
  userId: string,
  symbol: string | undefined,
  limit: number,
  page: number,
) => {
  return prisma.transaction.findMany({
    where: fundingWhere(userId, symbol),
    select: transactionSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });
};

export const countFundingPayments = async (userId: string, symbol?: string) => {
  return prisma.transaction.count({ where: fundingWhere(userId, symbol) });
};

// Liquidations come from the Order table (status=LIQUIDATED) joined with the
// fills that closed the position (the liquidation order is always the taker).
const liquidationSelect = {
  id: true,
  type: true,
  side: true,
  status: true,
  price: true,
  qty: true,
  filledQty: true,
  leverage: true,
  createdAt: true,
  updatedAt: true,
  market: { select: { symbol: true } },
  takerFills: {
    select: { id: true, price: true, qty: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const liquidationWhere = (userId: string, symbol?: string) => ({
  userId,
  status: "LIQUIDATED" as const,
  ...(symbol ? { market: { symbol } } : {}),
});

export const findLiquidations = async (
  userId: string,
  symbol: string | undefined,
  limit: number,
  page: number,
) => {
  return prisma.order.findMany({
    where: liquidationWhere(userId, symbol),
    select: liquidationSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });
};

export const countLiquidations = async (userId: string, symbol?: string) => {
  return prisma.order.count({ where: liquidationWhere(userId, symbol) });
};
