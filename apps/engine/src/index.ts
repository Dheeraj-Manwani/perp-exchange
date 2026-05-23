import { EngineRequest, GROUP_ENGINE, STREAM } from "@repo/schema";
import { Exchange } from "./core/Exchange";
import { brokerClient, connectRedis } from "./utils/redis-client";
import { sendResponse } from "./utils/response";
import { logger } from "@repo/logger";
import { handleEngineRequest } from "./request-handler";

(async () => {
  await connectRedis();

  for (;;) {
    const streams: any = await brokerClient.xReadGroup(
      GROUP_ENGINE,
      "engine-1",
      { key: STREAM, id: ">" },
      { COUNT: 1, BLOCK: 0 },
    );
    if (!streams) continue;

    for (const stream of streams) {
      for (const { id, message } of stream.messages) {
        console.log("id and message of stream.message ==== ", { id, message });
        let request: EngineRequest;

        try {
          const parsed = JSON.parse(message["data"]);
          if (!parsed.type || !parsed.responseQueue || !parsed.correlationId) {
            logger.error(
              { id, parsed },
              "Skipping invalid engine request (missing required fields)",
            );
            await brokerClient.xAck(STREAM, GROUP_ENGINE, id);
            continue;
          }
          request = parsed as EngineRequest;
        } catch {
          logger.error({ id }, "Skipping unparseable broker message");
          await brokerClient.xAck(STREAM, GROUP_ENGINE, id);
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

        await brokerClient.xAck(STREAM, GROUP_ENGINE, id);
      }
    }
  }
})();
