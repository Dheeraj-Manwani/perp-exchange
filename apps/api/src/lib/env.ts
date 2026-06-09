import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  ACCESS_TOKEN_SECRET: requireEnv("ACCESS_TOKEN_SECRET"),
  REFRESH_TOKEN_SECRET: requireEnv("REFRESH_TOKEN_SECRET"),
  REDIS_URL: requireEnv("REDIS_URL"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: process.env.PORT ?? "3001",
  ENGINE_QUEUE: "backend-to-engine-" + requireEnv("ENGINE_QUEUE_ID"),
  RESPONSE_QUEUE: "engine-to-backend-" + requireEnv("RESPONSE_QUEUE_ID"),
  PUBSUB_CHANNEL: "engine-to-backend-pubsub-" + requireEnv("RESPONSE_QUEUE_ID"),
  TIMEOUT_MS: Number(process.env.TIMEOUT_MS ?? "30000"),
  BATCH_SIZE: Number(process.env.BATCH_SIZE ?? 10),
  BLOCK_MS: Number(process.env.BLOCK_MS ?? 30_000),
};
