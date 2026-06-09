import { logger } from "@repo/logger";
import { EngineResponse } from "@repo/schema";

export const handleEngineToBackend = async (res: EngineResponse) => {
  if (!res.ok) {
    logger.warn(
      { userId: res.userId, type: res.type },
      "Received Error : ",
      res.error,
    );
    return;
  }

  // TODO: route each response type to the relevant ws subscriptions
  logger.info(
    { userId: res.userId, type: res.type },
    "engine response received (broadcast not implemented yet)",
  );
};
