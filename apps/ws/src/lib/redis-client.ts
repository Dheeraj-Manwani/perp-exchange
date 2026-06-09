import { createClient } from "redis";
import { env } from "./env";
import { logger } from "@repo/logger";

export const engineToBackendClient: ReturnType<typeof createClient> =
  createClient({
    url: env.REDIS_URL,
  }).on("error", (error) => {
    logger.error("Redis consumer error", error);
  });

export async function connectRedis(): Promise<void> {
  await engineToBackendClient.connect();
}
