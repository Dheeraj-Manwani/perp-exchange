import { OrderbookRegistry } from "./OrderbookRegistry";
import { PositionManager } from "./PositionManager";
import { UserRegistry } from "./UserRegistry";

export interface EngineSnapshot {
  orderbooks: ReturnType<OrderbookRegistry["serialise"]>;
  positions: ReturnType<PositionManager["serialise"]>;
  users: ReturnType<UserRegistry["serialise"]>;
}
