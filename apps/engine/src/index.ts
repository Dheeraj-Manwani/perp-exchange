import { EngineRequest, GROUP_ENGINE } from "@repo/schema";
import { v4 as uuid } from "uuid";
import { brokerClient, connectRedis } from "./utils/redis-client";
import { sendResponse } from "./utils/response";
import { logger } from "@repo/logger";
import { handleEngineRequest } from "./request-handler";
import { env } from "./utils/env";
import { fetchLastState } from "./utils/startup";
import { SnapshotService } from "./services/SnapshotService";
import { compareStreamIds } from "./utils/utils";
import "./utils/scheduler";

// Durable record of the last acked event id, updated on every ack
const LAST_ACKED_EVENT_ID_KEY = `${env.ENGINE_QUEUE}:last-acked-event-id`;

(async () => {
  await connectRedis();
  await fetchLastState();

  const snapshotService = SnapshotService.instance;
  const restored = await snapshotService.restoreLatestSnapshot();
  const lastAckedEventIdBeforeCrash = await brokerClient.get(
    LAST_ACKED_EVENT_ID_KEY,
  );

  if (restored) {
    // Rewind the consumer group to the snapshot's position so xReadGroup redelivers everything that happened after it was taken
    await brokerClient.xGroupSetId(
      env.ENGINE_QUEUE,
      GROUP_ENGINE,
      restored.lastRedisOrderEventId,
    );
  }

  const ack = async (id: string) => {
    await brokerClient
      .multi()
      .xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id)
      .set(LAST_ACKED_EVENT_ID_KEY, id)
      .exec();
    snapshotService.updateLastEventId(id);
  };

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
        // Replayed events at or before this checkpoint were already acked
        const alreadyAcked =
          lastAckedEventIdBeforeCrash !== null &&
          compareStreamIds(id, lastAckedEventIdBeforeCrash) <= 0;

        let parsed: any;
        try {
          parsed = JSON.parse(message["data"]);
          if (!parsed.type) {
            logger.error("invalid message — missing type");
            await ack(id);
            continue;
          }
        } catch {
          logger.error({ id }, "Skipping unparseable broker message");
          await ack(id);
          continue;
        }

        // index_price_update is fire-and-forget from market-data (no responseQueue/correlationId)
        if (
          (parsed.type === "index_price_update" ||
            parsed.type === "funding_settle") &&
          !parsed.responseQueue
        ) {
          try {
            const data = handleEngineRequest({
              ...parsed,
              userId: "system",
              correlationId: uuid(),
              responseQueue: env.RESPONSE_QUEUE,
            } as EngineRequest);
            logger.info(parsed.type);
            if (!alreadyAcked) {
              await sendResponse(env.RESPONSE_QUEUE, {
                userId: "system",
                type: parsed.type,
                correlationId: uuid(),
                sourceEventId: id,
                ok: true,
                data,
              });
            }
          } catch (error) {
            logger.error(
              { error, type: parsed.type },
              "Error processing market-data command",
            );
          }
          await ack(id);
          continue;
        }

        if (!parsed.responseQueue || !parsed.correlationId) {
          logger.error("invalid message — missing required fields");
          await ack(id);
          continue;
        }

        const request = parsed as EngineRequest;
        logger.info(request.type);

        try {
          const data = handleEngineRequest(request);
          if (!alreadyAcked) {
            await sendResponse(request.responseQueue, {
              userId: request.userId,
              type: request.type,
              correlationId: request.correlationId,
              sourceEventId: id,
              ok: true,
              data,
            });
          }
        } catch (error) {
          if (!alreadyAcked) {
            await sendResponse(request.responseQueue, {
              userId: request.userId,
              type: request.type,
              correlationId: request.correlationId,
              sourceEventId: id,
              ok: false,
              error: error instanceof Error ? error.message : "engine_error",
            });
          }
        }

        await ack(id);
      }
    }
  }
})();
