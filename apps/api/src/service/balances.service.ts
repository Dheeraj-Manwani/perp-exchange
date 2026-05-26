import { sendToEngine } from "../lib/engine-client";

export const onRamp = async (userId: string, amount: bigint) => {
  return sendToEngine("onramp", { userId, amount: amount.toString() }, userId);
};
