import { EngineRequest } from "@repo/schema";
import { Exchange } from "./core/Exchange";
import { Account } from "./core/Account";

const exchange = Exchange.instance;

export function handleEngineRequest(message: EngineRequest): unknown {
  switch (message.type) {
    case "create_user": {
      const { id, username } = message.payload as {
        id: string;
        username: string;
      };
      const account = new Account({ userId: id, username });
      exchange.users.add(account);
      return;
    }
    case "onramp": {
      const { userId, amount } = message.payload as {
        userId: string;
        amount: string;
      };
      exchange.accountService.onRamp(userId, BigInt(amount));
      return null;
    }
    case "create_order":
    case "cancel_order":
      throw new Error(`Command not yet implemented: ${message.type}`);
    default:
      throw new Error(`Unknown command type: ${message.type}`);
  }
}
