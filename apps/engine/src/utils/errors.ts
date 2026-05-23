import { formatBigInt } from "./math";
export class InsufficientMarginError extends Error {
  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient margin: required ${formatBigInt(required, 2)}, available ${formatBigInt(available, 2)}`,
    );
    this.name = "InsufficientMarginError";
  }
}
