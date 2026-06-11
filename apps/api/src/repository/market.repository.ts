import { prisma } from "@repo/db";

const marketSelect = {
  id: true,
  marketSlug: true,
  symbol: true,
  imageUrl: true,
  decimals: true,
  tickSize: true,
  minQty: true,
  maxLeverage: true,
  maintenanceMarginBps: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const findActiveMarkets = async () => {
  return prisma.market.findMany({
    where: { isActive: true },
    select: marketSelect,
    orderBy: { symbol: "asc" },
  });
};

export const findMarketBySymbol = async (symbol: string) => {
  return prisma.market.findUnique({
    where: { symbol },
    select: marketSelect,
  });
};

export const findLatestFundingRate = async (marketId: string) => {
  return prisma.fundingRate.findFirst({
    where: { marketId },
    orderBy: { settledAt: "desc" },
  });
};

export const findFundingRateHistory = async (
  marketId: string,
  limit: number,
  page: number,
) => {
  return prisma.fundingRate.findMany({
    where: { marketId },
    orderBy: { settledAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });
};

export const countFundingRates = async (marketId: string) => {
  return prisma.fundingRate.count({ where: { marketId } });
};
