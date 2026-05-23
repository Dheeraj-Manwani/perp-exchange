import { EngineResponse } from "@repo/schema";
import { responseClient } from "./redis-client";

export async function sendResponse(responseQueue: string, response: EngineResponse): Promise<void> {
  await responseClient.xAdd(
    responseQueue,
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
