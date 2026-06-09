import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  REDIS_URL: requireEnv("REDIS_URL"),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  ENGINE_TO_BACKEND_QUEUE:
    "engine-to-backend-" + requireEnv("RESPONSE_QUEUE_ID"),
  WS_PORT: Number(process.env.WS_PORT ?? 8080),
  BATCH_SIZE: Number(process.env.BATCH_SIZE ?? 10),
  BLOCK_MS: Number(process.env.BLOCK_MS ?? 30_000),
};
