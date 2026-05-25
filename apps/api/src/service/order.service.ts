import { OrderInput } from "@repo/schema";
import { sendToEngine } from "../lib/engine-client";

export const createOrder = async (data: OrderInput) => {
  return await sendToEngine("create_order", data);
};
