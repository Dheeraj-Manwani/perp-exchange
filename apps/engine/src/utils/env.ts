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
  ENGINE_QUEUE: "backend-to-engine-" + requireEnv("ENGINE_QUEUE_ID"),
  RESPONSE_QUEUE: "engine-to-backend-" + requireEnv("RESPONSE_QUEUE_ID"),
  AWS_ACCESS_KEY_ID: requireEnv("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: requireEnv("AWS_SECRET_ACCESS_KEY"),
  AWS_REGION: requireEnv("AWS_REGION"),
  S3_BUCKET_NAME: requireEnv("S3_BUCKET_NAME"),
};
