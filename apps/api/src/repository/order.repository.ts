import { prisma } from "@repo/db";
import { OrderHistoryQuery, OrderStatus } from "@repo/schema";

const orderSelect = {
  id: true,
  marketId: true,
  type: true,
  side: true,
  status: true,
  price: true,
  qty: true,
  slippage: true,
  filledQty: true,
  leverage: true,
  reduceOnly: true,
  createdAt: true,
  updatedAt: true,
  market: { select: { symbol: true } },
} as const;

const fillSelect = {
  id: true,
  price: true,
  qty: true,
  createdAt: true,
} as const;

const OPEN_STATUSES: OrderStatus[] = ["OPEN", "PARTIALLY_FILLED"];

export const findOpenOrders = async (userId: string, symbol?: string) => {
  return prisma.order.findMany({
    where: {
      userId,
      status: { in: OPEN_STATUSES },
      ...(symbol ? { market: { symbol } } : {}),
    },
    select: orderSelect,
    orderBy: { createdAt: "desc" },
  });
};

const historyWhere = (
  userId: string,
  symbol?: string,
  status?: OrderStatus,
) => ({
  userId,
  ...(symbol ? { market: { symbol } } : {}),
  ...(status ? { status } : {}),
});

export const findOrderHistory = async (
  userId: string,
  query: OrderHistoryQuery,
) => {
  return prisma.order.findMany({
    where: historyWhere(userId, query.symbol, query.status),
    select: orderSelect,
    orderBy: { createdAt: "desc" },
    take: query.limit,
    skip: (query.page - 1) * query.limit,
  });
};

export const countOrderHistory = async (
  userId: string,
  query: OrderHistoryQuery,
) => {
  return prisma.order.count({
    where: historyWhere(userId, query.symbol, query.status),
  });
};

export const findOrderWithFills = async (orderId: string) => {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ...orderSelect,
      userId: true,
      takerFills: { select: fillSelect, orderBy: { createdAt: "asc" } },
      makerFills: { select: fillSelect, orderBy: { createdAt: "asc" } },
    },
  });
};
