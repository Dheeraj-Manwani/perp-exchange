import { sendToEngine } from "../lib/engine-client";

export const onRamp = async (amount: bigint) => {
  const res = await sendToEngine("onramp", { amount });
  return res;
};
