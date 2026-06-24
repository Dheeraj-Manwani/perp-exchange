"use client";

import * as React from "react";

import { useTrade } from "./trade-context";
import { api, type PublicTrade, type OrderbookLevel } from "@/lib/api";
import { scaledToNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Level {
  price: number;
  size: number;
  cumulative: number;
  fillPercent: number;
}

// The matching engine's live order book isn't exposed over REST, so the book is
// rendered synthetically around the live mark price for depth visualisation.
function buildBook(mid: number) {
  const tick = mid > 1000 ? mid * 0.0001 : mid * 0.0005;
  const make = (dir: 1 | -1): Level[] => {
    const levels: Level[] = [];
    let cum = 0;
    for (let i = 1; i <= 12; i++) {
      const size = +(Math.random() * 4 + 0.2).toFixed(3);
      cum += size;
      levels.push({
        price: +(mid + dir * tick * i).toFixed(2),
        size,
        cumulative: +cum.toFixed(3),
        fillPercent: 0,
      });
    }
    const max = Math.max(...levels.map((l) => l.cumulative));
    return levels.map((l) => ({
      ...l,
      fillPercent: (l.cumulative / max) * 100,
    }));
  };
  return { asks: make(1), bids: make(-1) };
}

export function OrderBook() {
  const { market, markPrice, decimals } = useTrade();
  const [tab, setTab] = React.useState<"book" | "trades">("book");

  return (
    <div className="flex w-full flex-shrink-0 flex-col overflow-hidden border-l border-border bg-panel">
      <div className="flex items-center gap-1 border-b border-border px-2.5 py-2">
        {(["book", "trades"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] transition-colors",
              tab === t
                ? "bg-elevated text-foreground"
                : "text-t2 hover:text-foreground",
            )}
          >
            {t === "book" ? "Order Book" : "Trades"}
          </button>
        ))}
      </div>

      {tab === "book" ? (
        <BookView symbol={market?.symbol} decimals={decimals} mid={markPrice} />
      ) : (
        <TradesView symbol={market?.symbol} decimals={decimals} />
      )}
    </div>
  );
}

interface BookState {
  bids: Level[];
  asks: Level[];
  synthetic: boolean;
}

// Engine returns levels sorted (bids desc, asks asc) as [price, qty] strings.
// Cumulative is summed best→worst; the depth bar is scaled to the deepest level.
function toLevels(raw: OrderbookLevel[], decimals: number): Level[] {
  let cum = 0;
  const levels = raw.map(([price, qty]) => {
    const size = Number(qty);
    cum += size;
    return {
      price: scaledToNumber(price, decimals),
      size,
      cumulative: cum,
      fillPercent: 0,
    };
  });
  const max = levels.length ? levels[levels.length - 1]!.cumulative : 0;
  return levels.map((l) => ({
    ...l,
    fillPercent: max ? (l.cumulative / max) * 100 : 0,
  }));
}

function BookView({
  symbol,
  decimals,
  mid,
}: {
  symbol: string | undefined;
  decimals: number;
  mid: number | null;
}) {
  const [book, setBook] = React.useState<BookState | null>(null);

  React.useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const ob = await api.getOrderbook(symbol, 20);
        if (cancelled) return;
        setBook({
          bids: toLevels(ob.bids, decimals),
          asks: toLevels(ob.asks, decimals),
          synthetic: false,
        });
      } catch {
        // Engine/endpoint offline → synthetic depth around the mark price so the
        // panel stays populated (clearly flagged below).
        if (cancelled) return;
        if (mid !== null) {
          const b = buildBook(mid);
          setBook({ bids: b.bids, asks: b.asks, synthetic: true });
        } else {
          setBook(null);
        }
      }
    };

    poll();
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, decimals, mid]);

  if (!book) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-t3">
        Orderbook unavailable
      </div>
    );
  }

  if (book.bids.length === 0 && book.asks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-t3">
        No resting orders
      </div>
    );
  }

  const bestAsk = book.asks[0]?.price ?? null;
  const bestBid = book.bids[0]?.price ?? null;
  const spread =
    bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;
  const refPrice =
    bestAsk !== null && bestBid !== null ? (bestAsk + bestBid) / 2 : mid;
  const spreadPct =
    spread !== null && refPrice ? (spread / refPrice) * 100 : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-3 border-b border-line-light px-2.5 py-1">
        {["Price", "Size", "Cum."].map((h) => (
          <span key={h} className="text-[10px] uppercase tracking-wide text-t3">
            {h}
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-end overflow-hidden">
        {[...book.asks].reverse().map((l, i) => (
          <BookRow key={`a${i}`} level={l} side="ask" />
        ))}
      </div>

      <div className="grid grid-cols-3 border-y border-line-light bg-elevated px-2.5 py-1">
        <span
          className="font-mono text-[10px] font-semibold text-yellow"
          title={
            book.synthetic ? "Simulated depth — engine offline" : undefined
          }
        >
          Spread{book.synthetic ? " *" : ""}
        </span>
        <span className="font-mono text-[10px] text-yellow">
          {spread !== null ? spread.toFixed(2) : "—"}
        </span>
        <span className="font-mono text-[10px] text-yellow">
          {spreadPct !== null ? `${spreadPct.toFixed(3)}%` : "—"}
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {book.bids.map((l, i) => (
          <BookRow key={`b${i}`} level={l} side="bid" />
        ))}
      </div>
    </div>
  );
}

function BookRow({ level, side }: { level: Level; side: "ask" | "bid" }) {
  const isAsk = side === "ask";
  return (
    <div className="relative grid h-[22px] grid-cols-3 items-center px-2.5">
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 opacity-50",
          isAsk ? "bg-down/12" : "bg-up/12",
        )}
        style={{ width: `${level.fillPercent}%` }}
      />
      <span
        className={cn(
          "relative z-10 font-mono text-[11px]",
          isAsk ? "text-down" : "text-up",
        )}
      >
        {formatPrice(level.price)}
      </span>
      <span className="relative z-10 font-mono text-[11px] text-foreground">
        {level.size.toFixed(3)}
      </span>
      <span className="relative z-10 font-mono text-[11px] text-t2">
        {level.cumulative.toFixed(3)}
      </span>
    </div>
  );
}

function TradesView({
  symbol,
  decimals,
}: {
  symbol: string | undefined;
  decimals: number;
}) {
  const [trades, setTrades] = React.useState<PublicTrade[] | null>(null);

  React.useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const t = await api.getPublicTrades(symbol, 40);
        if (!cancelled) setTrades(Array.isArray(t) ? t : []);
      } catch {
        if (!cancelled) setTrades([]);
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-3 border-b border-line-light px-2.5 py-1">
        {["Price", "Size", "Time"].map((h) => (
          <span key={h} className="text-[10px] uppercase tracking-wide text-t3">
            {h}
          </span>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {trades === null ? (
          <div className="p-4 text-center text-xs text-t3">Loading…</div>
        ) : trades.length === 0 ? (
          <div className="p-4 text-center text-xs text-t3">
            No recent trades
          </div>
        ) : (
          trades.map((t) => {
            const isLong = t.takerSide === "LONG";
            return (
              <div
                key={t.id}
                className="grid h-[22px] grid-cols-3 items-center px-2.5"
              >
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    t.takerSide
                      ? isLong
                        ? "text-up"
                        : "text-down"
                      : "text-foreground",
                  )}
                >
                  {formatPrice(scaledToNumber(t.price, decimals))}
                </span>
                <span className="font-mono text-[11px] text-foreground">
                  {t.qty}
                </span>
                <span className="font-mono text-[11px] text-t2">
                  {new Date(t.createdAt).toLocaleTimeString("en-US", {
                    hour12: false,
                  })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
