import z from "zod";

// Symbols are matched case-insensitively against Market.symbol.
const optionalSymbolFilter = z
  .string()
  .min(1)
  .transform((s) => s.toUpperCase())
  .optional();

const paginated = {
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  page: z.coerce.number().int().min(1).default(1),
};

// GET /positions/history — closed positions derived from REALISED_PNL ledger
// rows (Transaction.marketId landed in sprint 4). Optional ?symbol= scope.
export const positionHistoryQuery = z.object({
  symbol: optionalSymbolFilter,
  ...paginated,
});
export type PositionHistoryQuery = z.infer<typeof positionHistoryQuery>;
