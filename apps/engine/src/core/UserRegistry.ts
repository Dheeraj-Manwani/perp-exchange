import { Account } from "./Account";

export class UserRegistry {
  private byId: Map<string, Account> = new Map();

  add(account: Account): void {
    this.byId.set(account.userId, account);
  }

  getById(userId: string) {
    return this.byId.get(userId);
  }
}
