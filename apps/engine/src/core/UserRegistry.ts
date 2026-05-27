import { AccountParams } from "@repo/schema";
import { Account } from "./Account";

export class UserRegistry {
  private byId: Map<string, Account> = new Map();

  constructor(existingUsers?: AccountParams[]) {
    if (existingUsers?.length) {
      existingUsers.forEach((us) => this.byId.set(us.userId, new Account(us)));
    }
  }

  add(account: Account): void {
    if (this.byId.has(account.userId)) return;
    this.byId.set(account.userId, account);
  }

  getById(userId: string) {
    return this.byId.get(userId);
  }
}
