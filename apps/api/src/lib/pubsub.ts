import { EngineResponse } from "@repo/schema";
import { logger } from "@repo/logger";
import { pubSubSubscriber } from "./redis-client";
import { env } from "./env";

export const initPubSub = async () => {
  await pubSubSubscriber.subscribe(env.PUBSUB_CHANNEL, (message) => {
    try {
      const response = JSON.parse(message) as EngineResponse;

      // TODO: resolve the pending request matching response.correlationId
      logger.info(
        { type: response.type, correlationId: response.correlationId },
        "pubsub engine response received",
      );
    } catch (error) {
      logger.error({ error }, "Invalid pubsub message — skipping");
    }
  });

  logger.info({ channel: env.PUBSUB_CHANNEL }, "subscribed to engine pubsub");
};
