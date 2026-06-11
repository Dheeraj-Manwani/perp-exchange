import {
  cancelOrderPayload,
  EngineRequest,
  fundingSettlePayload,
  GetIndexPriceEngineResponse,
  getIndexPricePayload,
  IndexPriceUpdateEngineResponse,
  indexPriceChangePayload,
  onRampPayload,
  orderInputSchema,
  signupPayload,
} from "@repo/schema";
import { Exchange } from "./core/Exchange";
import { Account } from "./core/Account";

export function handleEngineRequest(
  message: EngineRequest,
): Record<string, unknown> | undefined {
  const exchange = Exchange.instance;

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
    case "cancel_order": {
      const { orderId, symbol, side } = cancelOrderPayload.parse(
        message.payload,
      );
      return exchange.orderService.cancelOrder(
        message.userId,
        orderId,
        symbol,
        side,
      );
    }
    case "index_price_update": {
      const { marketPrices } = indexPriceChangePayload.parse(message.payload);
      const markets: IndexPriceUpdateEngineResponse[] = [];
      for (const [market, price] of Object.entries(marketPrices)) {
        markets.push(exchange.liquidation.onPriceUpdate(market, BigInt(price)));
      }
      return { markets };
    }
    case "get_index_price": {
      const { symbol } = getIndexPricePayload.parse(message.payload);
      const orderbook = exchange.orderbooks.get(symbol);
      const response: GetIndexPriceEngineResponse = {
        symbol,
        indexPrice: orderbook.indexPrice.toString(),
        updatedAt: orderbook.indexPriceUpdatedAt,
      };
      return response as unknown as Record<string, unknown>;
    }
    case "funding_settle": {
      const { period } = fundingSettlePayload.parse(message.payload);
      return exchange.funding.settle(period);
    }
    default:
      throw new Error(`Unknown command type: ${message.type}`);
  }
}
