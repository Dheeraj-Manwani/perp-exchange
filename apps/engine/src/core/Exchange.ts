import { AccountService } from "../services/AccountService";
import { OrderService } from "../services/OrderService";
import {
  existingMarkets,
  existingUsers,
  fetchLastState,
} from "../utils/startup";
import { OrderbookRegistry } from "./OrderbookRegistry";
import { PositionManager } from "./PositionManager";
import { UserRegistry } from "./UserRegistry";

export class Exchange {
  static readonly instance: Exchange = new Exchange();

  readonly users: UserRegistry;
  readonly orderbooks: OrderbookRegistry;
  readonly positions: PositionManager;

  readonly accountService: AccountService;
  readonly orderService: OrderService;

  constructor() {
    // TODO: better crash recovery
    this.users = new UserRegistry(existingUsers);
    this.orderbooks = new OrderbookRegistry(existingMarkets);
    this.positions = new PositionManager();

    this.accountService = new AccountService(this.users);
    this.orderService = new OrderService(
      this.users,
      this.orderbooks,
      this.positions,
    );
  }
}
