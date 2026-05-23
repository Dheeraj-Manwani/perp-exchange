import { EngineRequest, EngineResponse, STREAM } from "@repo/schema";
import { env } from "./utils/env";
import {
  brokerClient,
  connectRedis,
  responseClient,
} from "./utils/redis-client";
import { sendResponse } from "./utils/response";

await connectRedis();

function handleEngineRequest(message: EngineRequest) {
  switch (message.type) {
  }
}

for (;;) {
  const item = await brokerClient.xReadGroup(
    env.ENGINE_QUEUE,
    "1",
    { key: STREAM, id: ">" },
    { COUNT: 1, BLOCK: 0 },
  );
  if (!item) continue;

  let message: EngineRequest;

  try {
    message = JSON.parse(item.toString()) as EngineRequest;
  } catch {
    console.error("Skipping invalid broker message");
    continue;
  }

  try {
    const data = handleEngineRequest(message);
    await sendResponse({
      correlationId: message.correlationId,
      ok: true,
      data,
    });
  } catch (error) {
    await sendResponse({
      correlationId: message.correlationId,
      ok: false,
      error: error instanceof Error ? error.message : "engine_error",
    });
  }
}
