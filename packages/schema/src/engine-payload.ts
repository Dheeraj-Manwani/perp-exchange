import z from "zod";

export const onRampPayload = z.object({
  userId: z.string(),
  amount: z.string(),
});

export type OnRampPayload = z.infer<typeof onRampPayload>;

export const signupPayload = z.object({
  userId: z.string(),
  username: z.string(),
});

export type SignupPayload = z.infer<typeof signupPayload>;

export const cancelOrderPayload = z.object({
  orderId: z.string(),
  symbol: z.string(),
  side: z.enum(["LONG", "SHORT"]),
});

export type CancelOrderPayload = z.infer<typeof cancelOrderPayload>;
