import { prisma, OrderStatus } from "@repo/db";
import { CreateOrderEngineResponse } from "@repo/schema";
import { getMarketBySymbol } from "./market.repository";

export const createOrder = async (input: CreateOrderEngineResponse, userId: string) => {
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
        price: BigInt(input.price),
        qty: BigInt(Math.round(input.qty)),
        slippage: parseInt(input.slippage),
        leverage: input.leverage,
        reduceOnly: input.isReduceOnly,
        filledQty: BigInt(Math.round(input.filledQty)),
        status: input.status as OrderStatus,
      },
      update: {
        filledQty: BigInt(Math.round(input.filledQty)),
        status: input.status as OrderStatus,
      },
      where: { id: input.orderId },
    });

    if (input.fills.length > 0) {
      await tx.fill.createMany({
        data: input.fills.map((f) => ({
          takerOrderId: input.orderId,
          makerOrderId: f.makerOrderId,
          takerUserId: userId,
          makerUserId: f.makerUserId,
          marketId: market.id,
          price: BigInt(f.price),
          qty: BigInt(Math.round(f.qty)),
        })),
      });
    }

    return order;
  });
};
