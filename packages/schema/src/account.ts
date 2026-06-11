import z from "zod";

// Mirrors the Prisma TransactionType enum — the audit ledger's income types
// (Binance /fapi/v1/income parallels: DEPOSIT, FUNDING, REALIZED_PNL, ...).
export const transactionTypeSchema = z.enum([
  "DEPOSIT",
  "WITHDRAWAL",
  "TRADE_FEE",
  "FUNDING",
  "LIQUIDATION",
  "REALISED_PNL",
  "INSURANCE_FUND",
]);
export type TransactionTypeFilter = z.infer<typeof transactionTypeSchema>;

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

// GET /account/transactions — full ledger, optional ?type= filter.
export const accountTransactionsQuery = z.object({
  type: transactionTypeSchema.optional(),
  ...paginated,
});
export type AccountTransactionsQuery = z.infer<typeof accountTransactionsQuery>;

// GET /account/funding-payments — type=FUNDING rows, optional ?symbol= scope.
export const fundingPaymentsQuery = z.object({
  symbol: optionalSymbolFilter,
  ...paginated,
});
export type FundingPaymentsQuery = z.infer<typeof fundingPaymentsQuery>;

// GET /account/liquidations — status=LIQUIDATED orders, optional ?symbol= scope.
export const liquidationsQuery = z.object({
  symbol: optionalSymbolFilter,
  ...paginated,
});
export type LiquidationsQuery = z.infer<typeof liquidationsQuery>;
