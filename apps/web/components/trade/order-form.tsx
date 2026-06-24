"use client";

import * as React from "react";
import { toast } from "sonner";

import { useTrade } from "./trade-context";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  api,
  ApiError,
  type Balance,
  type OrderSide,
  type OrderType,
} from "@/lib/api";
import { scaledToNumber, formatUsd, toScaledString } from "@/lib/format";

const ORDER_TYPES: OrderType[] = ["MARKET", "LIMIT"];

export function OrderForm() {
  const { market, markPrice, decimals, refresh, refreshKey } = useTrade();
  const { isAuthenticated, setAuthOpen } = useAuth();

  const [side, setSide] = React.useState<OrderSide>("LONG");
  const [type, setType] = React.useState<OrderType>("LIMIT");
  const [price, setPrice] = React.useState("");
  const [priceEdited, setPriceEdited] = React.useState(false);
  const [qty, setQty] = React.useState("");
  const [leverage, setLeverage] = React.useState(10);
  const [submitting, setSubmitting] = React.useState(false);
  const [balance, setBalance] = React.useState<Balance | null>(null);

  const maxLev = market?.maxLeverage ?? 20;

  React.useEffect(() => {
    setLeverage((l) => Math.min(l, maxLev));
  }, [maxLev]);

  // Default the limit price to mark price until the user edits it.
  React.useEffect(() => {
    if (!priceEdited && markPrice !== null) setPrice(markPrice.toFixed(2));
  }, [markPrice, priceEdited]);

  // Load available USDC balance.
  React.useEffect(() => {
    if (!isAuthenticated) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    api
      .getBalances()
      .then((rows) => {
        if (cancelled) return;
        setBalance(rows.find((b) => b.asset === "USDC") ?? rows[0] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshKey]);

  const isLong = side === "LONG";
  const humanPrice = type === "MARKET" ? (markPrice ?? 0) : Number(price) || 0;
  const qtyNum = Number(qty) || 0;
  const orderValue = qtyNum * humanPrice;
  const available = balance ? scaledToNumber(balance.available, decimals) : null;

  const setPctOfMargin = (pct: number) => {
    if (available === null || humanPrice <= 0) return;
    const notional = (available * leverage * pct) / 100;
    setQty(String(Math.max(0, Math.floor(notional / humanPrice))));
  };

  const submit = async () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    if (!market) return;
    if (qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      toast.error("Quantity must be a positive whole number of contracts");
      return;
    }
    if (qtyNum < market.minQty) {
      toast.error(`Minimum quantity is ${market.minQty} contracts`);
      return;
    }
    if (humanPrice <= 0) {
      toast.error("Price unavailable");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createOrder({
        symbol: market.symbol,
        type,
        side,
        qty: qtyNum,
        price: toScaledString(humanPrice, decimals),
        leverage,
        isReduceOnly: false,
      });
      toast.success(
        `${side} ${qtyNum} ${market.symbol} — ${res.status}` +
          (res.filledQty
            ? ` (filled ${res.filledQty} @ ${formatUsd(
                scaledToNumber(res.avgFillPrice, decimals),
              )})`
            : ""),
      );
      setQty("");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Order rejected");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex w-full flex-shrink-0 flex-col overflow-hidden border-l border-border bg-panel">
      {/* Long / Short */}
      <div className="flex flex-shrink-0">
        {(["LONG", "SHORT"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "h-10 flex-1 border-b-2 text-[13px] font-semibold capitalize transition-all",
              side === s
                ? s === "LONG"
                  ? "border-up bg-up/15 text-up"
                  : "border-down bg-down/15 text-down"
                : "border-transparent bg-elevated text-t2 hover:text-foreground",
            )}
          >
            {s === "LONG" ? "Long" : "Short"}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div className="flex flex-shrink-0 border-b border-border">
        {ORDER_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "h-9 flex-1 border-b-2 text-xs capitalize transition-all",
              type === t
                ? "border-primary text-foreground"
                : "border-transparent text-t2 hover:text-foreground",
            )}
          >
            {t.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-auto p-3">
        {/* Price */}
        {type === "LIMIT" ? (
          <div className="flex flex-col gap-1.5">
            <Label>Price</Label>
            <div className="relative">
              <Input
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceEdited(true);
                }}
                inputMode="decimal"
                className="pr-12 text-right font-mono"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-t3">
                USD
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-elevated px-2.5 py-2 text-[11px] text-t3">
            Executes at best available price
          </div>
        )}

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <Label>Amount (contracts)</Label>
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            className="text-right font-mono"
          />
          <div className="mt-1 flex gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <Button
                key={pct}
                variant="outline"
                size="sm"
                className="flex-1 text-[10px]"
                disabled={available === null}
                onClick={() => setPctOfMargin(pct)}
              >
                {pct === 100 ? "MAX" : `${pct}%`}
              </Button>
            ))}
          </div>
        </div>

        {/* Leverage */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <Label>Leverage</Label>
            <span className="font-mono text-xs font-semibold text-yellow">
              {leverage}x
            </span>
          </div>
          <Slider
            min={1}
            max={maxLev}
            step={1}
            value={[leverage]}
            onValueChange={([v]) => setLeverage(v ?? 1)}
          />
        </div>

        {/* Summary */}
        <div className="flex flex-col gap-1.5 border-y border-line-light py-2.5">
          <Row label="Order Value" value={`${formatUsd(orderValue)} USD`} />
          <Row
            label="Avail. Margin"
            value={available !== null ? `${formatUsd(available)} USD` : "–"}
          />
          <Row
            label="Mark Price"
            value={markPrice !== null ? formatUsd(markPrice) : "–"}
          />
        </div>

        <Button
          variant={isLong ? "long" : "short"}
          size="xl"
          disabled={submitting || !market}
          onClick={submit}
        >
          {!isAuthenticated
            ? "Connect to Trade"
            : submitting
              ? "Submitting…"
              : isLong
                ? "Open Long"
                : "Open Short"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[11px] text-t2">{label}</span>
      <span className="font-mono text-[11px] text-foreground">{value}</span>
    </div>
  );
}
