import { app } from "./app";
import { logger } from "@repo/logger";
import { env } from "./lib/env";
import { connectRedis } from "./lib/redis-client";
import { setupStream } from "./lib/stream-setup";
import { initPubSub } from "./lib/pubsub";

const main = async () => {
  await connectRedis();
  await setupStream();
  await initPubSub();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API server started");
  });
};

main();
