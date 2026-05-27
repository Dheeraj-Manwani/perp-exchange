import { AccountParams } from "@repo/schema";
import { DEFAULT_MAX_LEVERAGE } from "../utils/constants";
import { InsufficientMarginError } from "../utils/errors";
import { getMax, getMin } from "../utils/math";

export class Account {
  readonly userId: string;
  readonly username: string;

  maxLeverage: number;

  private _available: bigint;
  private _locked: bigint;

  constructor(params: AccountParams) {
    this.userId = params.userId;
    this.username = params.username;
    this.maxLeverage = params.maxLeverage ?? DEFAULT_MAX_LEVERAGE;
    this._available = params.available ?? 0n;
    this._locked = params.locked ?? 0n;
  }

  get collateral(): Readonly<{ available: bigint; locked: bigint }> {
    return { available: this._available, locked: this._locked };
  }

  get totalEquity(): bigint {
    return this._available + this._locked;
  }

  assertSufficientMargin(amount: bigint) {
    if (this._available < amount) {
      throw new InsufficientMarginError(amount, this._available);
    }
  }

  lockMargin(amount: bigint): void {
    if (this._available < amount) {
      throw new InsufficientMarginError(amount, this._available);
    }
    this._available -= amount;
    this._locked += amount;
  }

  unlockMargin(amount: bigint): void {
    const actual = getMin(amount, this._locked);
    this._locked -= actual;
    this._available += actual;
  }

  deposit(amount: bigint): void {
    if (amount <= 0n) throw new Error("Deposit amount should be positive");
    this._available += amount;

    console.log("final === ", this._available);
  }

  consumeLockedMargin(amount: bigint): void {
    this._locked = getMax(0n, this._locked - amount);
  }

  creditAvailable(amount: bigint): void {
    this._available += amount;
  }

  debitAvailable(amount: bigint): void {
    this._available = getMax(0n, this._available - amount);
  }
}
