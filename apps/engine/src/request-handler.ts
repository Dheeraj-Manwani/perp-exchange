import {
  EngineRequest,
  onRampPayload,
  orderInputSchema,
  signupPayload,
} from "@repo/schema";
import { Exchange } from "./core/Exchange";
import { Account } from "./core/Account";
import { logger } from "@repo/logger";

const exchange = Exchange.instance;

export function handleEngineRequest(
  message: EngineRequest,
): Record<string, unknown> | undefined {
  try {
    switch (message.type) {
      case "create_user": {
        const { userId, username } = signupPayload.parse(message.payload);
        const account = new Account({ userId, username });
        exchange.users.add(account);
        return;
      }
      case "onramp": {
        const { userId, amount } = onRampPayload.parse(message.payload);
        exchange.accountService.onRamp(userId, BigInt(amount));
        return;
      }
      case "create_order": {
        const data = orderInputSchema.parse(message.payload);
        return exchange.orderService.placeOrder(message.userId, data);
      }
      case "cancel_order":
        throw new Error(`Command not yet implemented: ${message.type}`);
      default:
        throw new Error(`Unknown command type: ${message.type}`);
    }
  } catch (e) {
    logger.error(e);
    logger.error("Payload not as per deign");
  }
}
