import { logger } from "@repo/logger";
import { INSURANCE_FUND_SEED } from "@repo/schema";

export class InsuranceFund {
  private _balance: bigint;

  constructor() {
    this._balance = INSURANCE_FUND_SEED;
  }

  get balance() {
    return this._balance;
  }

  absorb(amount: bigint) {
    this._balance -= amount;

    if (this._balance < 0) {
      logger.warn({ balance: this._balance }, "insurance fund is negative");
    }
  }

  contribute(amount: bigint) {
    this._balance += amount;
  }

  restore() {
    this._balance = INSURANCE_FUND_SEED;
  }
}
