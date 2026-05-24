import {
  GROUP_DB_SERVICE,
  GROUP_ENGINE,
  GROUP_MAIN_BACKEND,
} from "@repo/schema";
import { publisher } from "./redis-client";
import { logger } from "@repo/logger";
import { env } from "./env";
import { listenToEngine } from "./engine-client";

const createGroup = async (stream: string, group: string) => {
  try {
    await publisher.xGroupCreate(stream, group, "$", { MKSTREAM: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("BUSYGROUP")) {
      logger.debug(
        { stream, group },
        "Consumer group already exists, skipping creation",
      );
    } else {
      throw err;
    }
  }
};

export const setupStream = async () => {
  // Command stream — read by engine and DB service
  await createGroup(env.ENGINE_QUEUE, GROUP_ENGINE);
  await createGroup(env.ENGINE_QUEUE, GROUP_DB_SERVICE);

  // Response stream — read by this API server
  await createGroup(env.RESPONSE_QUEUE, GROUP_MAIN_BACKEND);
  await createGroup(env.RESPONSE_QUEUE, GROUP_DB_SERVICE);

  listenToEngine();
};
