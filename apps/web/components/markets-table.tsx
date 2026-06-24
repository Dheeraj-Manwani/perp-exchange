"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api, type Market } from "@/lib/api";
import { scaledToNumber, formatPrice, formatPct, bpsToPct } from "@/lib/format";

interface MarketRow extends Market {
  lastPrice: number | null;
  indexPrice: number | null;
  fundingPct: number | null;
}

const COIN_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  BNB: "#F3BA2F",
  ARB: "#28A0F0",
  OP: "#FF0420",
  AVAX: "#E84142",
  DOGE: "#C3A634",
  LINK: "#2A5ADA",
  SUI: "#6FBCF0",
  INJ: "#00F2FE",
  TIA: "#7B2FBE",
};

export function MarketsTable() {
  const [rows, setRows] = React.useState<MarketRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [favorites, setFavorites] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const markets = await api.getMarkets();
        if (cancelled) return;
        setRows(
          markets.map((m) => ({
            ...m,
            lastPrice: null,
            indexPrice: null,
            fundingPct: null,
          })),
        );
        setLoading(false);

        // Enrich each market with live mark price + funding (best effort).
        markets.forEach(async (m) => {
          const [mark, funding] = await Promise.allSettled([
            api.getMarkPrice(m.symbol),
            api.getFundingRate(m.symbol),
          ]);
          if (cancelled) return;
          setRows((prev) =>
            prev.map((r) =>
              r.symbol === m.symbol
                ? {
                    ...r,
                    lastPrice:
                      mark.status === "fulfilled"
                        ? scaledToNumber(mark.value.markPrice, m.decimals)
                        : r.lastPrice,
                    indexPrice:
                      mark.status === "fulfilled"
                        ? scaledToNumber(mark.value.indexPrice, m.decimals)
                        : r.indexPrice,
                    fundingPct:
                      funding.status === "fulfilled"
                        ? bpsToPct(funding.value.rateBps)
                        : r.fundingPct,
                  }
                : r,
            ),
          );
        });
      } catch {
        if (!cancelled) {
          setError("Could not load markets. Is the API running on :3001?");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFav = (symbol: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const filtered = rows.filter((m) =>
    m.symbol.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Markets</h1>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-t3" />
          <Input
            type="search"
            placeholder="Search markets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-6 flex flex-wrap gap-4">
        <StatCard label="Active Markets" value={String(rows.length || "—")} />
        <StatCard
          label="Max Leverage"
          value={
            rows.length
              ? `${Math.max(...rows.map((r) => r.maxLeverage))}x`
              : "—"
          }
        />
        <StatCard
          label="Favorites"
          value={String(favorites.size)}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-border bg-panel p-8 text-center text-sm text-down">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-panel">
          {/* Header */}
          <div className="grid grid-cols-[40px_1.6fr_1fr_1fr_1fr_0.8fr_120px] items-center gap-2 border-b border-border px-4 py-2.5">
            {[
              "",
              "Market",
              "Last Price",
              "Index Price",
              "Funding",
              "Max Lev",
              "",
            ].map((h, i) => (
              <span
                key={i}
                className="text-[10px] uppercase tracking-wider text-t3"
              >
                {h}
              </span>
            ))}
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-t2">
              Loading markets…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-t2">
              No markets found.
            </div>
          ) : (
            filtered.map((m, i) => (
              <Row
                key={m.symbol}
                market={m}
                even={i % 2 === 0}
                isFav={favorites.has(m.symbol)}
                onToggleFav={toggleFav}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-40 rounded-md border border-border bg-panel px-5 py-3.5">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-t3">
        {label}
      </div>
      <div className="font-mono text-xl font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function Row({
  market,
  even,
  isFav,
  onToggleFav,
}: {
  market: MarketRow;
  even: boolean;
  isFav: boolean;
  onToggleFav: (symbol: string, e: React.MouseEvent) => void;
}) {
  const base = market.symbol.replace("-PERP", "");
  const color = COIN_COLORS[base] ?? "#7A7A8C";

  return (
    <Link
      href={`/trade/${market.symbol}`}
      className={cn(
        "grid grid-cols-[40px_1.6fr_1fr_1fr_1fr_0.8fr_120px] items-center gap-2 border-b border-line-light px-4 transition-colors hover:bg-elevated",
        even ? "bg-base" : "bg-panel",
      )}
      style={{ height: 52 }}
    >
      <button
        onClick={(e) => onToggleFav(market.symbol, e)}
        className="flex items-center"
      >
        <Star
          className={cn(
            "size-3.5 transition-colors",
            isFav ? "fill-primary text-primary" : "text-t3 hover:text-primary",
          )}
        />
      </button>

      <div className="flex items-center gap-2.5">
        <div
          className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: color + "22",
            border: `1px solid ${color}44`,
            color,
          }}
        >
          {base.charAt(0)}
        </div>
        <div>
          <div className="text-[13px] font-semibold text-foreground">
            {market.symbol}
          </div>
          <div className="text-[11px] text-t3">{market.marketSlug}</div>
        </div>
      </div>

      <span className="font-mono text-[13px] text-foreground">
        {market.lastPrice !== null ? formatPrice(market.lastPrice) : "—"}
      </span>

      <span className="font-mono text-xs text-t2">
        {market.indexPrice !== null ? formatPrice(market.indexPrice) : "—"}
      </span>

      <span>
        {market.fundingPct !== null ? (
          <Badge variant={market.fundingPct >= 0 ? "yellow" : "down"}>
            {formatPct(market.fundingPct, 4)}
          </Badge>
        ) : (
          <span className="font-mono text-xs text-t3">—</span>
        )}
      </span>

      <span className="font-mono text-xs text-t2">{market.maxLeverage}x</span>

      <Button
        variant="outline"
        size="sm"
        className="border-primary/60 text-primary hover:bg-primary hover:text-primary-foreground"
        asChild
      >
        <span>Trade →</span>
      </Button>
    </Link>
  );
}
