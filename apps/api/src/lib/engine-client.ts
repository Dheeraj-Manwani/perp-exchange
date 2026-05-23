import {
  EngineCommandType,
  EngineRequest,
  EngineResponse,
  GROUP_MAIN_BACKEND,
  PendingResponse,
  STREAM,
} from "@repo/schema";
import { createClient } from "redis";
import { env } from "./env";
import { v4 as uuid } from "uuid";
import { publisher, subscriber } from "./redis-client";
import { Response, response } from "express";

export const pendingResponses: Map<string, PendingResponse> = new Map();

const waitForEngineToRespond = async (correlationId: string) => {
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
) => {
  const correlationId = uuid();
  const data: EngineRequest = {
    correlationId,
    type,
    payload,
    responseQueue: env.RESPONSE_QUEUE,
  };

  const responsePromise = waitForEngineToRespond(correlationId);

  await publisher.xadd(
    STREAM,
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

const listenToEngine = async () => {
  for (;;) {
    const response = await subscriber.xReadGroup(
      GROUP_MAIN_BACKEND,
      "1",
      { key: STREAM, id: ">" },
      { COUNT: env.BATCH_SIZE, BLOCK: 0 },
    );
    if (!response) continue;
    try {
      const parsedResponse = JSON.parse(response) as EngineResponse;

      resolveEngineResponse(parsedResponse);
    } catch (error) {
      console.error("Invalid engine response", error);
    }
  }
};

const resolveEngineResponse = async (response: EngineResponse) => {
  const pending = pendingResponses.get(response.correlationId);

  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingResponses.delete(response.correlationId);
  pending.resolve(response);
};
