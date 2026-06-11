import z from "zod";

export const marketSymbolParam = z
  .string()
  .min(1)
  .transform((s) => s.toUpperCase());

export const fundingRateHistoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

export type FundingRateHistoryQuery = z.infer<typeof fundingRateHistoryQuery>;
