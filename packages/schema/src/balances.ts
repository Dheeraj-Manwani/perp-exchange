import z from "zod";

export const onRampInuput = z.object({
  amount: z.bigint().positive(),
});

export type OnRampInput = z.infer<typeof onRampInuput>;
