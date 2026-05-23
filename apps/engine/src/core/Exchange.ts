import { AccountService } from "../services/AccountService";
import { UserRegistry } from "./UserRegistry";

export class Exchange {
  static readonly instance: Exchange = new Exchange();

  readonly users: UserRegistry;
  readonly accountService: AccountService;

  constructor() {
    this.users = new UserRegistry();
    this.accountService = new AccountService(this.users);
  }
}
