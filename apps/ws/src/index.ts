import { WebSocketServer } from "ws";
import { EngineResponse, GROUP_WS_SERVICE } from "@repo/schema";
import { logger } from "@repo/logger";
import { engineToBackendClient, connectRedis } from "./lib/redis-client";
import { env } from "./lib/env";
import { handleEngineToBackend } from "./handlers";

const CONSUMER = "ws-1";

const startWsServer = () => {
  const wss = new WebSocketServer({ port: env.WS_PORT });

  wss.on("connection", (ws) => {
    ws.on("error", (error) => logger.error({ error }, "ws connection error"));

    ws.on("message", (data) => {
      // TODO: handle subscribe/unsubscribe messages
      logger.info({ data: data.toString() }, "received ws message");
    });
  });

  logger.info({ port: env.WS_PORT }, "ws server listening");
  return wss;
};

const listenToResponseQueue = async () => {
  for (;;) {
    const streams: any = await engineToBackendClient.xReadGroup(
      GROUP_WS_SERVICE,
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
        } catch (error) {
          logger.error(
            { id, error },
            "Failed to process response message — skipping",
          );
        }
        await engineToBackendClient.xAck(
          env.ENGINE_TO_BACKEND_QUEUE,
          GROUP_WS_SERVICE,
          id,
        );
      }
    }
  }
};

(async () => {
  await connectRedis();
  logger.info("ws connected to Redis");

  startWsServer();

  await listenToResponseQueue();
})();
