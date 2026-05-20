import z from "zod";

export const authInput = z.object({
  username: z.string().min(4),
  password: z.string().min(4),
});

export type AuthInput = z.infer<typeof authInput>;
