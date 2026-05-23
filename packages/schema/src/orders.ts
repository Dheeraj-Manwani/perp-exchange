import z from "zod";

export const orderTypeSchema = z.enum(["limit", "market"]);
export const orderSideSchema = z.enum(["long", "short"]);

export type OrderType = z.infer<typeof orderTypeSchema>;
export type OrderSide = z.infer<typeof orderSideSchema>;

export const orderInputSchema = z.object({
  symbol: z.string(),
  type: orderTypeSchema,
  side: orderSideSchema,
  qty: z.number().positive(),
  price: z.bigint().positive().optional(),
  leverage: z.number().int().optional(),
});

export type OrderInput = z.infer<typeof orderInputSchema>;
