import { Account } from "./Account";

export class UserRegistry {
  private byId: Map<string, Account> = new Map();

  add(account: Account): void {
    if (this.byId.has(account.userId)) return;
    this.byId.set(account.userId, account);
  }

  getById(userId: string) {
    return this.byId.get(userId);
  }

  serialise() {
    return {
      byId: Array.from(this.byId).map(
        ([id, acc]) => [id, acc.serialise()] as const,
      ),
    };
  }

  restoreFrom(data: ReturnType<UserRegistry["serialise"]>): void {
    this.byId = new Map(
      data.byId.map(([id, account]) => [id, Account.fromSerialised(account)]),
    );
  }
}
