import { createClient } from "redis";
import { env } from "./env";
import { logger } from "@repo/logger";

export const publisher: ReturnType<typeof createClient> = createClient({
  url: env.REDIS_URL,
}).on("error", (error) => {
  logger.error("Redis publisher error", error);
});

export async function connectRedis(): Promise<void> {
  await publisher.connect();
}

export async function disconnectRedis() {
  await publisher.quit();
}
