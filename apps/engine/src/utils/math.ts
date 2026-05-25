export function formatBigInt(value: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals);

  const integerPart = value / factor;
  const fractionalPart = value % factor;

  return `${integerPart}.${fractionalPart.toString().padStart(decimals, "0")}`;
}

export const getMin = (a: bigint, b: bigint) => (a <= b ? a : b);
export const getMax = (a: bigint, b: bigint) => (a >= b ? a : b);

type Numeric = bigint | number | string;
type RoundingMode = "UP" | "DOWN";

export function mulDiv(
  multiply: Numeric[],
  divide: Numeric[] = [],
  rounding: RoundingMode = "DOWN",
): bigint {
  let numerator = 1n;
  let denominator = 1n;

  for (const value of multiply) {
    numerator *= BigInt(value);
  }

  for (const value of divide) {
    const divisor = BigInt(value);

    if (divisor === 0n) {
      throw new Error("Division by zero");
    }

    denominator *= divisor;
  }

  if (rounding === "UP") {
    return (numerator + denominator - 1n) / denominator;
  }

  return numerator / denominator;
}
