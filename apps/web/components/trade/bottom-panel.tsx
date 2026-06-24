"use client";

import * as React from "react";
import { toast } from "sonner";

import { useTrade } from "./trade-context";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  api,
  ApiError,
  type OrderDto,
  type PositionView,
  type FillDto,
} from "@/lib/api";
import {
  scaledToNumber,
  formatPrice,
  formatUsd,
  formatSignedUsd,
  formatTime,
  toScaledString,
} from "@/lib/format";

type FundingRow = {
  id: string;
  symbol: string | null;
  period: string;
  amount: string;
  createdAt: string;
};

export function BottomPanel() {
  const { isAuthenticated, setAuthOpen } = useAuth();
  const { refreshKey, refresh, decimals, markPrice } = useTrade();

  const [positions, setPositions] = React.useState<PositionView[] | null>(null);
  const [orders, setOrders] = React.useState<OrderDto[] | null>(null);
  const [fills, setFills] = React.useState<FillDto[] | null>(null);
  const [funding, setFunding] = React.useState<FundingRow[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setPositions(null);
      setOrders(null);
      setFills(null);
      setFunding(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const [p, o, f, fu] = await Promise.allSettled([
        api.getPositions(),
        api.getOpenOrders(),
        api.getUserFills(50, 1),
        api.getFundingPayments(undefined, 50, 1),
      ]);
      if (cancelled) return;
      setPositions(p.status === "fulfilled" ? p.value : []);
      setOrders(o.status === "fulfilled" ? o.value : []);
      setFills(f.status === "fulfilled" ? f.value.items : []);
      setFunding(fu.status === "fulfilled" ? fu.value.items : []);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshKey]);

  const closePosition = async (pos: PositionView) => {
    if (markPrice === null) {
      toast.error("Mark price unavailable");
      return;
    }
    setBusy(pos.positionId);
    try {
      await api.createOrder({
        symbol: pos.market,
        type: "MARKET",
        side: pos.side === "LONG" ? "SHORT" : "LONG",
        qty: pos.qty,
        price: toScaledString(markPrice, decimals),
        leverage: pos.leverage,
        isReduceOnly: true,
      });
      toast.success(`Closing ${pos.market} position`);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Close failed");
    } finally {
      setBusy(null);
    }
  };

  const cancelOrder = async (o: OrderDto) => {
    setBusy(o.orderId);
    try {
      await api.cancelOrder(o.orderId, o.symbol, o.side);
      toast.success("Order cancelled");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  };

  const cancelAll = async () => {
    setBusy("all");
    try {
      const res = await api.cancelAllOrders();
      toast.success(`Cancelled ${res.cancelled}/${res.total} orders`);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex h-52 flex-shrink-0 flex-col items-center justify-center gap-3 border-t border-border bg-panel text-sm text-t2">
        Sign in to view your positions, orders and history.
        <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)}>
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <Tabs
      defaultValue="positions"
      className="h-52 flex-shrink-0 border-t border-border bg-panel"
    >
      <div className="flex items-center justify-between border-b border-border pl-3 pr-3">
        <TabsList>
          <TabsTrigger value="positions">
            Positions ({positions?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="orders">
            Open Orders ({orders?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="trades">Trade History</TabsTrigger>
          <TabsTrigger value="funding">Funding History</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-auto">
        <TabsContent value="positions">
          <PositionsTable
            rows={positions}
            decimals={decimals}
            busy={busy}
            onClose={closePosition}
          />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTable
            rows={orders}
            decimals={decimals}
            busy={busy}
            onCancel={cancelOrder}
            onCancelAll={cancelAll}
          />
        </TabsContent>
        <TabsContent value="trades">
          <FillsTable rows={fills} decimals={decimals} />
        </TabsContent>
        <TabsContent value="funding">
          <FundingTable rows={funding} decimals={decimals} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

const HEAD = "text-[11px] uppercase tracking-wide text-t3";
const CELL = "font-mono text-xs text-foreground";

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-t3">
      {msg}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-t3">
      Loading…
    </div>
  );
}

function PositionsTable({
  rows,
  decimals,
  busy,
  onClose,
}: {
  rows: PositionView[] | null;
  decimals: number;
  busy: string | null;
  onClose: (p: PositionView) => void;
}) {
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty msg="No open positions" />;
  const cols = "grid grid-cols-[1.2fr_0.7fr_0.7fr_1fr_1fr_1fr_1.2fr_1fr_80px]";
  return (
    <div>
      <div className={cn(cols, "border-b border-line-light px-4 py-1.5")}>
        {[
          "Symbol",
          "Side",
          "Size",
          "Entry",
          "Mark",
          "Liq.",
          "PnL",
          "Margin",
          "",
        ].map((h, i) => (
          <span key={i} className={HEAD}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((p) => {
        const pnl = scaledToNumber(p.unrealisedPnl, decimals);
        return (
          <div
            key={p.positionId}
            className={cn(cols, "items-center px-4 py-2 hover:bg-elevated")}
          >
            <span className={cn(CELL, "font-semibold")}>{p.market}</span>
            <span
              className={cn(
                "text-xs font-medium",
                p.side === "LONG" ? "text-up" : "text-down",
              )}
            >
              {p.side === "LONG" ? "Long" : "Short"}
            </span>
            <span className={CELL}>{p.qty}</span>
            <span className={CELL}>
              {formatPrice(scaledToNumber(p.averagePrice, decimals))}
            </span>
            <span className={CELL}>
              {formatPrice(scaledToNumber(p.markPrice, decimals))}
            </span>
            <span className={CELL}>
              {formatPrice(scaledToNumber(p.liquidationPrice, decimals))}
            </span>
            <span
              className={cn(
                "font-mono text-xs font-semibold",
                pnl >= 0 ? "text-up" : "text-down",
              )}
            >
              {formatSignedUsd(pnl)}
            </span>
            <span className={CELL}>
              {formatUsd(scaledToNumber(p.margin, decimals))}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] hover:border-down hover:text-down"
              disabled={busy === p.positionId}
              onClick={() => onClose(p)}
            >
              Close
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function OrdersTable({
  rows,
  decimals,
  busy,
  onCancel,
  onCancelAll,
}: {
  rows: OrderDto[] | null;
  decimals: number;
  busy: string | null;
  onCancel: (o: OrderDto) => void;
  onCancelAll: () => void;
}) {
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty msg="No open orders" />;
  const cols = "grid grid-cols-[1.2fr_0.7fr_0.7fr_0.8fr_1fr_0.8fr_1fr_80px]";
  return (
    <div>
      <div
        className={cn(
          cols,
          "items-center border-b border-line-light px-4 py-1.5",
        )}
      >
        {["Symbol", "Side", "Type", "Status", "Price", "Qty", "Filled", ""].map(
          (h, i) => (
            <span key={i} className={HEAD}>
              {h}
            </span>
          ),
        )}
      </div>
      {rows.map((o) => (
        <div
          key={o.orderId}
          className={cn(cols, "items-center px-4 py-2 hover:bg-elevated")}
        >
          <span className={cn(CELL, "font-semibold")}>{o.symbol}</span>
          <span
            className={cn(
              "text-xs font-medium",
              o.side === "LONG" ? "text-up" : "text-down",
            )}
          >
            {o.side === "LONG" ? "Long" : "Short"}
          </span>
          <span className="text-xs text-t2">{o.type}</span>
          <Badge variant="outline" className="w-fit">
            {o.status}
          </Badge>
          <span className={CELL}>
            {formatPrice(scaledToNumber(o.price, decimals))}
          </span>
          <span className={CELL}>{o.qty}</span>
          <span className={CELL}>
            {o.filledQty}/{o.qty}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] hover:border-down hover:text-down"
            disabled={busy === o.orderId}
            onClick={() => onCancel(o)}
          >
            Cancel
          </Button>
        </div>
      ))}
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-down"
          disabled={busy === "all"}
          onClick={onCancelAll}
        >
          Cancel all
        </Button>
      </div>
    </div>
  );
}

function FillsTable({
  rows,
  decimals,
}: {
  rows: FillDto[] | null;
  decimals: number;
}) {
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty msg="No trade history" />;
  const cols = "grid grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1.4fr]";
  return (
    <div>
      <div className={cn(cols, "border-b border-line-light px-4 py-1.5")}>
        {["Symbol", "Role", "Price", "Qty", "Time"].map((h, i) => (
          <span key={i} className={HEAD}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((f) => (
        <div
          key={f.id}
          className={cn(cols, "items-center px-4 py-2 hover:bg-elevated")}
        >
          <span className={cn(CELL, "font-semibold")}>{f.symbol ?? "—"}</span>
          <span className="text-xs text-t2">{f.role ?? "—"}</span>
          <span className={CELL}>
            {formatPrice(scaledToNumber(f.price, decimals))}
          </span>
          <span className={CELL}>{f.qty}</span>
          <span className="font-mono text-xs text-t2">
            {formatTime(f.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FundingTable({
  rows,
  decimals,
}: {
  rows: FundingRow[] | null;
  decimals: number;
}) {
  if (rows === null) return <Loading />;
  if (rows.length === 0) return <Empty msg="No funding history" />;
  const cols = "grid grid-cols-[1.2fr_1fr_1.2fr_1.4fr]";
  return (
    <div>
      <div className={cn(cols, "border-b border-line-light px-4 py-1.5")}>
        {["Symbol", "Period", "Payment", "Time"].map((h, i) => (
          <span key={i} className={HEAD}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((r) => {
        const amt = scaledToNumber(r.amount, decimals);
        return (
          <div
            key={r.id}
            className={cn(cols, "items-center px-4 py-2 hover:bg-elevated")}
          >
            <span className={cn(CELL, "font-semibold")}>{r.symbol ?? "—"}</span>
            <span className="text-xs text-t2">{r.period}</span>
            <span
              className={cn(
                "font-mono text-xs",
                amt >= 0 ? "text-up" : "text-down",
              )}
            >
              {formatSignedUsd(amt)}
            </span>
            <span className="font-mono text-xs text-t2">
              {formatTime(r.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
