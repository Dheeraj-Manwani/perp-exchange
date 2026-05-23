import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    env: {
      ACCESS_TOKEN_SECRET: "test-access-secret-minimum-32-characters!",
      REFRESH_TOKEN_SECRET: "test-refresh-secret-minimum-32-characters!",
      REDIS_URL: "redis://localhost:6379",
      ENGINE_QUEUE_ID: "test",
      RESPONSE_QUEUE_ID: "test",
      TIMEOUT_MS: "5000",
      BATCH_SIZE: "10",
      BLOCK_MS: "5000",
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
      PORT: "3099",
    },
  },
});
