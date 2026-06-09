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

export type CancelledOrder = {
  orderId: string;
  userId: string;
  unfilledQty: number;
  price: bigint;
  leverage: number;
};

export const liquidationFillRecordSchema = z.object({
  makerOrderId: z.string(),
  makerUserId: z.string(),
  price: z.string(),
  qty: z.number(),
});

export type LiquidationFillRecord = z.infer<typeof liquidationFillRecordSchema>;

export const liquidationEventRecordSchema = z.object({
  liquidationOrderId: z.string(),
  positionId: z.string(),
  userId: z.string(),
  market: z.string(),
  side: orderSideSchema,
  qty: z.number(),
  filledQty: z.number(),
  avgFillPrice: z.string(),
  leverage: z.number(),
  fills: z.array(liquidationFillRecordSchema),
  adlTriggered: z.boolean(),
});

export type LiquidationEventRecord = z.infer<
  typeof liquidationEventRecordSchema
>;

export const indexPriceUpdateEngineResponseSchema = z.object({
  cancelledOrders: z.array(
    z.object({
      orderId: z.string(),
      userId: z.string(),
      releasedMargin: z.string(),
    }),
  ),
  liquidations: z.array(liquidationEventRecordSchema),
  balanceSnapshots: z.array(
    z.object({
      userId: z.string(),
      available: z.string(),
      locked: z.string(),
    }),
  ),
});

export type IndexPriceUpdateEngineResponse = z.infer<
  typeof indexPriceUpdateEngineResponseSchema
>;

export const indexPriceUpdateEngineResponsesSchema = z.object({
  markets: z.array(indexPriceUpdateEngineResponseSchema),
});

export const fundingPaymentRecordSchema = z.object({
  userId: z.string(),
  market: z.string(),
  side: orderSideSchema,
  qty: z.number(),
  markPrice: z.string(),
  payment: z.string(),
  direction: z.enum(["PAID", "RECEIVED"]),
});

export type FundingPaymentRecord = z.infer<typeof fundingPaymentRecordSchema>;

export const fundingSettleEngineResponseSchema = z.object({
  period: z.string(),
  markets: z.array(
    z.object({
      market: z.string(),
      fundingRateBps: z.string(),
      payments: z.array(fundingPaymentRecordSchema),
    }),
  ),
  balanceSnapshots: z.array(
    z.object({
      userId: z.string(),
      available: z.string(),
      locked: z.string(),
    }),
  ),
});

export type FundingSettleEngineResponse = z.infer<
  typeof fundingSettleEngineResponseSchema
>;
