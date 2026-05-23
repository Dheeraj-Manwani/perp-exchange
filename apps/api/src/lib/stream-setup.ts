import { GROUP_DB_SERVICE, GROUP_ENGINE, STREAM } from "@repo/schema";
import redis from "redis";
import { publisher, subscriber } from "./redis-client";
import { logger } from "@repo/logger";

export const setupStream = async () => {
  for (const group of [GROUP_ENGINE, GROUP_DB_SERVICE]) {
    try {
      await publisher.xGroupCreate(STREAM, group, "$", { MKSTREAM: true });
      await subscriber.xGroupCreate(STREAM, group, "$", { MKSTREAM: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("BUSYGROUP")) {
        // Group already exists — this is expected on restart. Safe to ignore.
        logger.debug(
          { stream: STREAM, group },
          "Consumer group already exists, skipping creation",
        );
      } else {
        throw err;
      }
    }
  }
};
