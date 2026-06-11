import z from "zod";

// Public recent-trades tape (sprint 3).
export const publicTradesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});
export type PublicTradesQuery = z.infer<typeof publicTradesQuery>;

// Authenticated user fill history.
export const userFillsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  page: z.coerce.number().int().min(1).default(1),
});
export type UserFillsQuery = z.infer<typeof userFillsQuery>;
