import z from "zod";

export const onRampInuput = z.object({
  amount: z.coerce.bigint().refine((v) => v > 0n, { message: "Amount must be positive" }),
});

export type OnRampInput = z.infer<typeof onRampInuput>;
