"use client";

import * as React from "react";
import { api, type Market } from "@/lib/api";
import { scaledToNumber } from "@/lib/format";

interface TradeContextValue {
  symbol: string;
  market: Market | null;
  decimals: number;
  markPrice: number | null;
  indexPrice: number | null;
  marketError: string | null;
  refreshKey: number;
  refresh: () => void;
}

const TradeContext = React.createContext<TradeContextValue | null>(null);

export function TradeProvider({
  symbol,
  children,
}: {
  symbol: string;
  children: React.ReactNode;
}) {
  const [market, setMarket] = React.useState<Market | null>(null);
  const [marketError, setMarketError] = React.useState<string | null>(null);
  const [markPrice, setMarkPrice] = React.useState<number | null>(null);
  const [indexPrice, setIndexPrice] = React.useState<number | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load market metadata once.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api.getMarket(symbol);
        if (!cancelled) setMarket(m);
      } catch {
        if (!cancelled)
          setMarketError(`Market ${symbol} not found or API offline.`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Poll mark/index price.
  React.useEffect(() => {
    if (!market) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const mp = await api.getMarkPrice(market.symbol);
        if (cancelled) return;
        setMarkPrice(scaledToNumber(mp.markPrice, market.decimals));
        setIndexPrice(scaledToNumber(mp.indexPrice, market.decimals));
      } catch {
        /* engine offline — keep last known */
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [market]);

  const value: TradeContextValue = {
    symbol,
    market,
    decimals: market?.decimals ?? 2,
    markPrice,
    indexPrice,
    marketError,
    refreshKey,
    refresh,
  };

  return (
    <TradeContext.Provider value={value}>{children}</TradeContext.Provider>
  );
}

export function useTrade(): TradeContextValue {
  const ctx = React.useContext(TradeContext);
  if (!ctx) throw new Error("useTrade must be used within TradeProvider");
  return ctx;
}
