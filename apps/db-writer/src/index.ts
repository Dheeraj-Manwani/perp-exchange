import { EngineRequest, EngineResponse, GROUP_DB_SERVICE } from "@repo/schema";
import { logger } from "@repo/logger";
import {
  backendToEngineClient,
  engineToBackendClient,
  connectRedis,
} from "./lib/redis-client";
import { env } from "./lib/env";
import { handleBackendToEngine, handleEngineToBackend } from "./handlers";

const CONSUMER = "db-writer-1";

const listenToCommandQueue = async () => {
  for (;;) {
    const streams: any = await backendToEngineClient.xReadGroup(
      GROUP_DB_SERVICE,
      CONSUMER,
      { key: env.BACKEND_TO_ENGINE_QUEUE, id: ">" },
      { COUNT: env.BATCH_SIZE, BLOCK: env.BLOCK_MS },
    );
    if (!streams) continue;

    for (const stream of streams) {
      for (const { id, message } of stream.messages) {
        try {
          const request = JSON.parse(message["data"]) as EngineRequest;

          await handleBackendToEngine(request);

          logger.info(request.type);
          await backendToEngineClient.xAck(
            env.BACKEND_TO_ENGINE_QUEUE,
            GROUP_DB_SERVICE,
            id,
          );
        } catch (error) {
          logger.error(
            { id, error },
            "Failed to process command message — skipping",
          );
          await backendToEngineClient.xAck(
            env.BACKEND_TO_ENGINE_QUEUE,
            GROUP_DB_SERVICE,
            id,
          );
        }
      }
    }
  }
};

const listenToResponseQueue = async () => {
  for (;;) {
    const streams: any = await engineToBackendClient.xReadGroup(
      GROUP_DB_SERVICE,
      CONSUMER,
      { key: env.ENGINE_TO_BACKEND_QUEUE, id: ">" },
      { COUNT: env.BATCH_SIZE, BLOCK: env.BLOCK_MS },
    );
    if (!streams) continue;

    for (const stream of streams) {
      for (const { id, message } of stream.messages) {
        try {
          const response = JSON.parse(message["data"]) as EngineResponse;

          await handleEngineToBackend(response);

          logger.info(response.ok ? "response ok" : "response error");
          await engineToBackendClient.xAck(
            env.ENGINE_TO_BACKEND_QUEUE,
            GROUP_DB_SERVICE,
            id,
          );
        } catch (error) {
          logger.error(
            { id, error },
            "Failed to process response message — skipping",
          );
          await engineToBackendClient.xAck(
            env.ENGINE_TO_BACKEND_QUEUE,
            GROUP_DB_SERVICE,
            id,
          );
        }
      }
    }
  }
};

(async () => {
  await connectRedis();
  logger.info("db-writer connected to Redis");

  await Promise.all([listenToCommandQueue(), listenToResponseQueue()]);
})();
