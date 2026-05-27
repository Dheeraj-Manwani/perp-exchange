import { CancelOrderInput, OrderInput } from "@repo/schema";
import { sendToEngine } from "../lib/engine-client";

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
