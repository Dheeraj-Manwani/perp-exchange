import { EngineRequest, GROUP_ENGINE } from "@repo/schema";
import { v4 as uuid } from "uuid";
import { brokerClient, connectRedis } from "./utils/redis-client";
import { sendResponse } from "./utils/response";
import { logger } from "@repo/logger";
import { handleEngineRequest } from "./request-handler";
import { env } from "./utils/env";
import { fetchLastState } from "./utils/startup";

(async () => {
  await connectRedis();
  // TODO: refinement needed for crash recovery in the startup logic (s3)
  await fetchLastState();
  for (;;) {
    const streams: any = await brokerClient.xReadGroup(
      GROUP_ENGINE,
      "engine-1",
      { key: env.ENGINE_QUEUE, id: ">" },
      { COUNT: 1, BLOCK: 0 },
    );
    if (!streams) continue;

    for (const stream of streams) {
      for (const { id, message } of stream.messages) {
        let parsed: any;
        try {
          parsed = JSON.parse(message["data"]);
          if (!parsed.type) {
            logger.error("invalid message — missing type");
            await brokerClient.xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id);
            continue;
          }
        } catch {
          logger.error({ id }, "Skipping unparseable broker message");
          await brokerClient.xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id);
          continue;
        }

        // index_price_update is fire-and-forget from market-data (no responseQueue/correlationId)
        if (parsed.type === "index_price_update" && !parsed.responseQueue) {
          try {
            const data = handleEngineRequest({
              ...parsed,
              userId: "system",
              correlationId: uuid(),
              responseQueue: env.RESPONSE_QUEUE,
            } as EngineRequest);
            logger.info("index_price_update");
            await sendResponse(env.RESPONSE_QUEUE, {
              userId: "system",
              type: "index_price_update",
              correlationId: uuid(),
              ok: true,
              data,
            });
          } catch (error) {
            logger.error({ error }, "Error processing index_price_update");
          }
          await brokerClient.xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id);
          continue;
        }

        if (!parsed.responseQueue || !parsed.correlationId) {
          logger.error("invalid message — missing required fields");
          await brokerClient.xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id);
          continue;
        }

        const request = parsed as EngineRequest;
        logger.info(request.type);

        try {
          const data = handleEngineRequest(request);
          await sendResponse(request.responseQueue, {
            userId: request.userId,
            type: request.type,
            correlationId: request.correlationId,
            ok: true,
            data,
          });
        } catch (error) {
          await sendResponse(request.responseQueue, {
            userId: request.userId,
            type: request.type,
            correlationId: request.correlationId,
            ok: false,
            error: error instanceof Error ? error.message : "engine_error",
          });
        }

        await brokerClient.xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id);
      }
    }
  }
})();
