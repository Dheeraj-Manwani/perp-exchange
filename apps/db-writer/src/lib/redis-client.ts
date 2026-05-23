import { createClient } from "redis";
import { env } from "./env";
import { logger } from "@repo/logger";

export const backendToEngineClient: ReturnType<typeof createClient> =
  createClient({
    url: env.REDIS_URL,
  }).on("error", (error) => {
    logger.error("Redis publisher error", error);
  });

export const engineToBackendClient: ReturnType<typeof createClient> =
  createClient({
    url: env.REDIS_URL,
  }).on("error", (error) => {
    logger.error("Redis publisher error", error);
  });

export async function connectRedis(): Promise<void> {
  await Promise.all([
    backendToEngineClient.connect(),
    engineToBackendClient.connect(),
  ]);
}
