import { EngineResponse } from "@repo/schema";
import { pubSubClient, responseClient } from "./redis-client";
import { env } from "./env";

export async function sendResponse(
  responseQueue: string,
  response: EngineResponse,
): Promise<void> {
  await responseClient.xAdd(
    responseQueue,
    "*",
    {
      data: JSON.stringify(response),
    },
    {
      TRIM: {
        strategy: "MINID",
        strategyModifier: "~",
        threshold: Date.now() - 90 * 24 * 60 * 60 * 1000,
      },
    },
  );
}

export async function sendPubSubResponse(
  response: EngineResponse,
): Promise<void> {
  await pubSubClient.publish(env.PUBSUB_CHANNEL, JSON.stringify(response));
}
