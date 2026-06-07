import { prisma, OrderStatus } from "@repo/db";
import {
  CreateOrderEngineResponse,
  IndexPriceUpdateEngineResponse,
  TAKER_FEE_RATE,
  MAKER_FEE_RATE,
} from "@repo/schema";
import { getMarketBySymbol } from "./market.repository";

export const cancelOrder = async (
  orderId: string,
  userId: string,
  releasedMargin: string,
) => {
  return await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" as OrderStatus },
    });

    if (releasedMargin !== "0") {
      const balance = await tx.balance.findFirst({
        where: { userId, asset: "USD" },
        select: { availableBalance: true, lockedBalance: true },
      });
      if (balance) {
        const released = BigInt(releasedMargin);
        const newAvailable = BigInt(balance.availableBalance) + released;
        const newLocked = BigInt(balance.lockedBalance) - released;
        await tx.balance.updateMany({
          where: { userId, asset: "USD" },
          data: {
            availableBalance: newAvailable.toString(),
            lockedBalance: (newLocked < 0n ? 0n : newLocked).toString(),
          },
        });
      }
    }
  });
};

export const createOrder = async (
  input: CreateOrderEngineResponse,
  userId: string,
) => {
  const market = await getMarketBySymbol(input.symbol);
  if (!market) throw new Error("Invalid market");

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.upsert({
      create: {
        id: input.orderId,
        userId,
        marketId: market.id,
        type: input.type,
        side: input.side,
        price: input.price,
        qty: String(input.qty),
        slippage: parseInt(input.slippage),
        leverage: input.leverage,
        reduceOnly: input.isReduceOnly,
        filledQty: String(input.filledQty),
        status: input.status as OrderStatus,
      },
      update: {
        filledQty: String(input.filledQty),
        status: input.status as OrderStatus,
      },
      where: { id: input.orderId },
    });

    await tx.balance.updateMany({
      where: { userId, asset: "USD" },
      data: {
        availableBalance: input.takerBalanceSnapshot.available,
        lockedBalance: input.takerBalanceSnapshot.locked,
      },
    });

    if (input.fills.length > 0) {
      await tx.fill.createMany({
        data: input.fills.map((f) => ({
          takerOrderId: input.orderId,
          makerOrderId: f.makerOrderId,
          takerUserId: userId,
          makerUserId: f.makerUserId,
          marketId: market.id,
          price: f.price,
          qty: String(f.qty),
        })),
      });

      const takerFee = String(
        Math.round(
          Number(input.avgFillPrice) * input.filledQty * TAKER_FEE_RATE,
        ),
      );

      const makerFees = input.fills.map((f) => ({
        userId: f.makerUserId,
        fee: String(Math.round(Number(f.price) * f.qty * MAKER_FEE_RATE)),
      }));

      const uniqueUserIds = [
        ...new Set([userId, ...makerFees.map((m) => m.userId)]),
      ];
      const balanceRows = await tx.balance.findMany({
        where: { userId: { in: uniqueUserIds }, asset: "USD" },
        select: { userId: true, availableBalance: true },
      });
      const balanceMap = new Map(
        balanceRows.map((b) => [b.userId, b.availableBalance]),
      );

      await tx.transaction.createMany({
        data: [
          {
            userId,
            type: "TRADE_FEE" as const,
            asset: "USD",
            amount: takerFee,
            balanceAfter: balanceMap.get(userId) ?? "0",
          },
          ...makerFees.map((m) => ({
            userId: m.userId,
            type: "TRADE_FEE" as const,
            asset: "USD",
            amount: m.fee,
            balanceAfter: balanceMap.get(m.userId) ?? "0",
          })),
        ],
      });
    }

    return order;
  });
};

export const processLiquidations = async (
  data: IndexPriceUpdateEngineResponse,
) => {
  const { cancelledOrders, liquidations, balanceSnapshots } = data;
  if (cancelledOrders.length === 0 && liquidations.length === 0) return;

  await prisma.$transaction(async (tx) => {
    if (cancelledOrders.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: cancelledOrders.map((o) => o.orderId) } },
        data: { status: "LIQUIDATED" },
      });
    }

    for (const liq of liquidations) {
      if (liq.filledQty === 0) continue;

      const market = await getMarketBySymbol(liq.market);
      if (!market) continue;

      await tx.order.create({
        data: {
          id: liq.liquidationOrderId,
          userId: liq.userId,
          marketId: market.id,
          type: "MARKET",
          side: liq.side,
          status: "LIQUIDATED",
          price: liq.avgFillPrice,
          qty: String(liq.qty),
          filledQty: String(liq.filledQty),
          leverage: liq.leverage,
          reduceOnly: true,
        },
      });

      if (liq.fills.length > 0) {
        await tx.fill.createMany({
          data: liq.fills.map((f) => ({
            takerOrderId: liq.liquidationOrderId,
            makerOrderId: f.makerOrderId,
            takerUserId: liq.userId,
            makerUserId: f.makerUserId,
            marketId: market.id,
            price: f.price,
            qty: String(f.qty),
          })),
        });
      }

      const snapshot = balanceSnapshots.find((s) => s.userId === liq.userId);
      await tx.transaction.create({
        data: {
          userId: liq.userId,
          type: "LIQUIDATION",
          asset: "USD",
          amount: liq.avgFillPrice,
          balanceAfter: snapshot?.available ?? "0",
        },
      });
    }

    for (const snap of balanceSnapshots) {
      await tx.balance.updateMany({
        where: { userId: snap.userId, asset: "USD" },
        data: {
          availableBalance: snap.available,
          lockedBalance: snap.locked,
        },
      });
    }
  });
};
