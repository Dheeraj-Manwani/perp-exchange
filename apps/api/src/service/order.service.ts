import {
  CancelOrderEngineResponse,
  CancelOrderInput,
  OpenOrdersQuery,
  OrderHistoryQuery,
  OrderInput,
} from "@repo/schema";
import { sendToEngine } from "../lib/engine-client";
import { AppError, ErrorCode } from "../errors/AppError";
import * as orderRepository from "../repository/order.repository";

export const createOrder = async (data: OrderInput, userId: string) => {
  return await sendToEngine(
    "create_order",
    { ...data, price: data.price.toString(), slippage: data.slippage.toString() },
    userId,
  );
};

export const cancelOrder = async (
  orderId: string,
  data: CancelOrderInput,
  userId: string,
) => {
  return await sendToEngine("cancel_order", { orderId, ...data }, userId);
};

// ─── Reads (sprint 2) ─────────────────────────────────────────────────────────

type OrderRow = Awaited<
  ReturnType<typeof orderRepository.findOpenOrders>
>[number];

const toOrderDto = (o: OrderRow) => ({
  orderId: o.id,
  symbol: o.market.symbol,
  type: o.type,
  side: o.side,
  status: o.status,
  price: o.price,
  qty: o.qty,
  filledQty: o.filledQty,
  slippage: o.slippage,
  leverage: o.leverage,
  reduceOnly: o.reduceOnly,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});

export const getOpenOrders = async (userId: string, query: OpenOrdersQuery) => {
  const rows = await orderRepository.findOpenOrders(userId, query.symbol);
  return rows.map(toOrderDto);
};

export const getOrderHistory = async (
  userId: string,
  query: OrderHistoryQuery,
) => {
  const [rows, total] = await Promise.all([
    orderRepository.findOrderHistory(userId, query),
    orderRepository.countOrderHistory(userId, query),
  ]);

  return {
    items: rows.map(toOrderDto),
    page: query.page,
    limit: query.limit,
    total,
  };
};

export const getOrderById = async (userId: string, orderId: string) => {
  const order = await orderRepository.findOrderWithFills(orderId);

  // 404 (not 403) when the order belongs to another user, so existence isn't leaked.
  if (!order || order.userId !== userId) {
    throw new AppError(
      404,
      ErrorCode.ORDER_NOT_FOUND,
      `Order not found: ${orderId}`,
    );
  }

  const fills = [
    ...order.takerFills.map((f) => ({ ...f, role: "TAKER" as const })),
    ...order.makerFills.map((f) => ({ ...f, role: "MAKER" as const })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return {
    ...toOrderDto(order),
    fills: fills.map((f) => ({
      id: f.id,
      price: f.price,
      qty: f.qty,
      role: f.role,
      createdAt: f.createdAt,
    })),
  };
};

// Cancel-all reads the user's open orders from the DB, then fans out one
// `cancel_order` engine command per order (each with its own correlationId).
// Responses are per-order rather than all-or-nothing: a cancel can race a fill
// and legitimately fail, which shouldn't abort the rest.
export const cancelAllOrders = async (userId: string, symbol?: string) => {
  const open = await orderRepository.findOpenOrders(userId, symbol);

  const orders = await Promise.all(
    open.map(async (o) => {
      try {
        const resp = await sendToEngine(
          "cancel_order",
          { orderId: o.id, symbol: o.market.symbol, side: o.side },
          userId,
        );

        if (resp.ok) {
          const data = resp.data as CancelOrderEngineResponse | undefined;
          return {
            orderId: o.id,
            status: "CANCELLED" as const,
            releasedMargin: data?.releasedMargin ?? null,
          };
        }

        return {
          orderId: o.id,
          status: "FAILED" as const,
          error: resp.error ?? "cancel_rejected",
        };
      } catch (err) {
        return {
          orderId: o.id,
          status: "FAILED" as const,
          error: err instanceof Error ? err.message : "cancel_failed",
        };
      }
    }),
  );

  return {
    total: open.length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
    orders,
  };
};
