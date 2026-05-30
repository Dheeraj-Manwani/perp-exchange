import z from "zod";

export const orderTypeSchema = z.enum(["LIMIT", "MARKET"]);
export const orderSideSchema = z.enum(["LONG", "SHORT"]);
export const orderStatusSchema = z.enum([
  "PENDING",
  "OPEN",
  "PARTIALLY_FILLED",
  "FILLED",
  "CANCELLED",
  "REJECTED",
  "LIQUIDATED",
]);

export type OrderType = z.infer<typeof orderTypeSchema>;
export type OrderSide = z.infer<typeof orderSideSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderInputSchema = z.object({
  orderId: z.string().optional(),
  symbol: z.string(),
  type: orderTypeSchema,
  side: orderSideSchema,
  qty: z.number().int().positive(),
  price: z
    .string()
    .regex(/^\d+$/, "Price must be a numeric string")
    .transform((v) => BigInt(v))
    .refine((v) => v > 0n, { message: "Price must be positive" }),
  slippage: z.coerce.bigint().optional().default(0n),
  leverage: z.number().int().optional().default(1),
  isReduceOnly: z.boolean().default(false),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export const fillRecordSchema = z.object({
  makerOrderId: z.string(),
  makerUserId: z.string(),
  price: z.string(),
  qty: z.number().int(),
});

export type FillRecord = z.infer<typeof fillRecordSchema>;

// BigInt fields (price, slippage, avgFillPrice) are serialized as strings for JSON transport.
export const createOrderEngineResponseSchema = z.object({
  orderId: z.string(),
  symbol: z.string(),
  type: orderTypeSchema,
  side: orderSideSchema,
  qty: z.number().int().positive(),
  price: z.string(),
  slippage: z.string().default("0"),
  leverage: z.number().int().default(1),
  isReduceOnly: z.boolean().default(false),
  filledQty: z.number().int(),
  unfilled: z.number().int(),
  avgFillPrice: z.string(),
  status: orderStatusSchema,
  fills: z.array(fillRecordSchema),
  takerBalanceSnapshot: z.object({
    available: z.string(),
    locked: z.string(),
  }),
});

export type CreateOrderEngineResponse = z.infer<
  typeof createOrderEngineResponseSchema
>;

export const cancelOrderInputSchema = z.object({
  symbol: z.string(),
  side: orderSideSchema,
});

export type CancelOrderInput = z.infer<typeof cancelOrderInputSchema>;

export const cancelOrderEngineResponseSchema = z.object({
  orderId: z.string(),
  releasedMargin: z.string(),
});

export type CancelOrderEngineResponse = z.infer<
  typeof cancelOrderEngineResponseSchema
>;
