import {
  EngineCommandType,
  EngineRequest,
  EngineResponse,
  GROUP_MAIN_BACKEND,
  PendingResponse,
} from "@repo/schema";
import { env } from "./env";
import { v4 as uuid } from "uuid";
import { publisher, subscriber } from "./redis-client";
import { logger } from "@repo/logger";

export const pendingResponses: Map<string, PendingResponse> = new Map();

const waitForEngineToRespond = (
  correlationId: string,
): Promise<EngineResponse> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingResponses.delete(correlationId);
      reject(new Error("Engine response timed out"));
    }, env.TIMEOUT_MS);

    pendingResponses.set(correlationId, { resolve, reject, timeout });
  });
};

export const sendToEngine = async (
  type: EngineCommandType,
  payload: Record<string, unknown>,
  userId: string,
): Promise<EngineResponse> => {
  const correlationId = uuid();
  const data: EngineRequest = {
    userId,
    correlationId,
    type,
    payload,
    responseQueue: env.RESPONSE_QUEUE,
  };

  const responsePromise = waitForEngineToRespond(correlationId);

  await publisher.xAdd(
    env.ENGINE_QUEUE,
    "*",
    { data: JSON.stringify(data) },
    {
      TRIM: {
        strategy: "MINID",
        strategyModifier: "~",
        threshold: Date.now() - 90 * 24 * 60 * 60 * 1000,
      },
    },
  );

  return responsePromise;
};

export const listenToEngine = async () => {
  for (;;) {
    const streams: any = await subscriber.xReadGroup(
      GROUP_MAIN_BACKEND,
      "api-1",
      { key: env.RESPONSE_QUEUE, id: ">" },
      { COUNT: env.BATCH_SIZE, BLOCK: env.BLOCK_MS },
    );
    if (!streams) continue;

    for (const stream of streams) {
      for (const { id, message } of stream.messages) {
        try {
          const parsed = JSON.parse(message["data"]) as EngineResponse;
          await subscriber.xAck(env.RESPONSE_QUEUE, GROUP_MAIN_BACKEND, id);
          resolveEngineResponse(parsed);
        } catch (error) {
          logger.error({ id, error }, "Invalid engine response — skipping");
        }
      }
    }
  }
};

const resolveEngineResponse = (response: EngineResponse) => {
  const pending = pendingResponses.get(response.correlationId);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingResponses.delete(response.correlationId);
  pending.resolve(response);
};
