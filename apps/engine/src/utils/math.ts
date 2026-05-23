export function formatBigInt(value: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals);

  const integerPart = value / factor;
  const fractionalPart = value % factor;

  return `${integerPart}.${fractionalPart.toString().padStart(decimals, "0")}`;
}

export const getMin = (a: bigint, b: bigint) => (a < b ? a : b);
