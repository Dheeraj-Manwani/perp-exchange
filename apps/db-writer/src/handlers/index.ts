import { logger } from "@repo/logger";
import { EngineRequest, EngineResponse, onRampPayload } from "@repo/schema";
import { updateAmountForUser } from "../repository/users.repository";

export const handleBackendToEngine = async (data: EngineRequest) => {
  switch (data.type) {
    case "onramp": {
      const { userId, amount } = onRampPayload.parse(data.payload);

      logger.info({ userId, amount }, "Adding amount to db for user");
      await updateAmountForUser(userId, BigInt(amount));
    }
  }
};

export const handleEngineToBackend = async (data: EngineResponse) => {};
