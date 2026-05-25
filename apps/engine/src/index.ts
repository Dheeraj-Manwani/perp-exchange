import { EngineRequest, GROUP_ENGINE } from "@repo/schema";
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
        let request: EngineRequest;

        try {
          const parsed = JSON.parse(message["data"]);
          if (!parsed.type || !parsed.responseQueue || !parsed.correlationId) {
            logger.error("invalid message — missing required fields");
            await brokerClient.xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id);
            continue;
          }
          request = parsed as EngineRequest;
          logger.info(request.type);
        } catch {
          logger.error({ id }, "Skipping unparseable broker message");
          await brokerClient.xAck(env.ENGINE_QUEUE, GROUP_ENGINE, id);
          continue;
        }

        try {
          const data = handleEngineRequest(request);
          await sendResponse(request.responseQueue, {
            correlationId: request.correlationId,
            ok: true,
            data,
          });
        } catch (error) {
          await sendResponse(request.responseQueue, {
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
