import { AccountService } from "../services/AccountService";
import { OrderService } from "../services/OrderService";
import { ReadQueryService } from "../services/ReadQueryService";
import { existingMarkets } from "../utils/startup";
import { EngineSnapshot } from "./EngineSnapshot";
import { FundingEngine } from "./FundingEngine";
import { InsuranceFund } from "./InsuranceFund";
import { LiquidationEngine } from "./LiquidationEngine";
import { OrderbookRegistry } from "./OrderbookRegistry";
import { PositionManager } from "./PositionManager";
import { UserRegistry } from "./UserRegistry";

export class Exchange {
  private static _instance: Exchange | undefined;

  static get instance(): Exchange {
    if (!Exchange._instance) Exchange._instance = new Exchange();
    return Exchange._instance;
  }

  readonly users: UserRegistry;
  readonly orderbooks: OrderbookRegistry;
  readonly positions: PositionManager;

  readonly accountService: AccountService;
  readonly orderService: OrderService;
  readonly readQuery: ReadQueryService;

  readonly insurance: InsuranceFund;
  readonly liquidation: LiquidationEngine;
  readonly funding: FundingEngine;

  constructor() {
    this.users = new UserRegistry();
    this.orderbooks = new OrderbookRegistry(existingMarkets);
    this.positions = new PositionManager();

    this.accountService = new AccountService(this.users);
    this.orderService = new OrderService(
      this.users,
      this.orderbooks,
      this.positions,
    );
    this.readQuery = new ReadQueryService(
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
    this.funding = new FundingEngine(
      this.users,
      this.positions,
      this.orderbooks,
    );
  }

  getSnapshotData(): EngineSnapshot {
    return {
      orderbooks: this.orderbooks.serialise(),
      positions: this.positions.serialise(),
      users: this.users.serialise(),
    };
  }

  restoreFromSnapshot(snapshot: EngineSnapshot): void {
    this.orderbooks.restoreFrom(snapshot.orderbooks);
    this.positions.restoreFrom(snapshot.positions);
    this.users.restoreFrom(snapshot.users);
  }
}
