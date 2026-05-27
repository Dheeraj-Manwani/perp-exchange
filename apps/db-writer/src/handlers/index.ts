import { logger } from "@repo/logger";
import {
  EngineRequest,
  EngineResponse,
  onRampPayload,
  createOrderEngineResponseSchema,
  cancelOrderEngineResponseSchema,
} from "@repo/schema";
import { updateAmountForUser } from "../repository/user.repository";
import { cancelOrder, createOrder } from "../repository/order.repository";

export const handleBackendToEngine = async (data: EngineRequest) => {
  // switch (data.type) {
  //   case "onramp": {
  //     const { userId, amount } = onRampPayload.parse(data.payload);
  //     logger.info({ userId, amount }, "Adding amount to db for user");
  //     return await updateAmountForUser(userId, BigInt(amount));
  //   }
  //   case "create_order": {
  //     const parsedData = orderInputSchema.parse(data.payload);
  //     logger.info({ userId: data.userId }, "Init order");
  //   }
  // }
};

export const handleEngineToBackend = async (res: EngineResponse) => {
  if (!res.ok) {
    logger.warn(
      { userId: res.userId, type: res.type },
      "Recieved Error : ",
      res.error,
    );
    return;
  }
  switch (res.type) {
    case "onramp": {
      const { userId, amount } = onRampPayload.parse(res.data);

      logger.info({ userId, amount }, "Adding amount to db for user");
      return await updateAmountForUser(userId, BigInt(amount));
    }
    case "create_order": {
      const parsedData = createOrderEngineResponseSchema.parse(res.data);
      logger.info({ userId: res.userId }, "saving new order");
      return await createOrder(parsedData, res.userId);
    }
    case "cancel_order": {
      const { orderId, releasedMargin } = cancelOrderEngineResponseSchema.parse(res.data);
      logger.info({ userId: res.userId, orderId }, "cancelling order");
      return await cancelOrder(orderId, res.userId, releasedMargin);
    }
  }
};
