import { AccountParams } from "@repo/schema";
import { Account } from "../core/Account";
import { UserRegistry } from "../core/UserRegistry";

export class AccountService {
  constructor(private readonly users: UserRegistry) {}

  addAccount(params: AccountParams) {
    const account = new Account(params);
    this.users.add(account);
  }

  onRamp(userId: string, amount: bigint) {
    const account = this.users.getById(userId);

    if (!account) throw new Error("Account not found");

    account.deposit(amount);
  }
}
