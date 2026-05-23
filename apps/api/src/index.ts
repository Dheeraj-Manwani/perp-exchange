import { app } from "./app";
import { logger } from "@repo/logger";
import { env } from "./lib/env";
import { connectRedis } from "./lib/redis-client";
import { setupStream } from "./lib/stream-setup";

const main = async () => {
  await connectRedis();
  await setupStream();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API server started");
  });
};

main();
