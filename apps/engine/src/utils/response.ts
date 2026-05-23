import { EngineResponse, STREAM } from "@repo/schema";
import { responseClient } from "./redis-client";

export async function sendResponse(response: EngineResponse): Promise<void> {
  await responseClient.xAdd(
    STREAM,
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
