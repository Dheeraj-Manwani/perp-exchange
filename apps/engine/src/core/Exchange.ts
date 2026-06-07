import { AccountService } from "../services/AccountService";
import { OrderService } from "../services/OrderService";
import {
  existingMarkets,
  existingUsers,
  fetchLastState,
} from "../utils/startup";
import { InsuranceFund } from "./InsuranceFund";
import { LiquidationEngine } from "./LiquidationEngine";
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

  readonly insurance: InsuranceFund;
  readonly liquidation: LiquidationEngine;

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

    this.insurance = new InsuranceFund();
    this.liquidation = new LiquidationEngine(
      this.users,
      this.positions,
      this.orderbooks,
      this.insurance,
    );
  }
}
