// The API uses a scaled-integer convention: prices/amounts are integer strings
// scaled by 10^decimals (Market.decimals, default 2). Qty is whole contracts.

export function scaledToNumber(
  value: string | number | bigint | null | undefined,
  decimals = 2,
): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** decimals;
}

// Human price -> scaled integer string for order submission.
export function toScaledString(human: number, decimals = 2): string {
  return Math.round(human * 10 ** decimals).toString();
}

export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 10000)
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

export function formatUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export function formatPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function formatSignedUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${formatUsd(n, digits)}`;
}

export function formatTime(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// bps (basis points) -> percent string. rateBps is stored as a string.
export function bpsToPct(bps: string | number | null | undefined): number {
  if (bps === null || bps === undefined) return 0;
  return Number(bps) / 100;
}
