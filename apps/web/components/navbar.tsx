"use client";

import * as React from "react";
import Link from "next/link";
import { Square, Wallet, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DepositDialog } from "@/components/deposit-dialog";
import { useAuth } from "@/hooks/use-auth";
import { api, type Market, type MarkPrice } from "@/lib/api";
import { scaledToNumber, formatPrice } from "@/lib/format";

interface Ticker {
  symbol: string;
  price: number | null;
}

export function Navbar() {
  const { isAuthenticated, username, setAuthOpen, signOut } = useAuth();
  const [tickers, setTickers] = React.useState<Ticker[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const markets: Market[] = await api.getMarkets();
        const top = markets.slice(0, 6);
        const withPrices = await Promise.all(
          top.map(async (m) => {
            try {
              const mp: MarkPrice = await api.getMarkPrice(m.symbol);
              return {
                symbol: m.symbol,
                price: scaledToNumber(mp.markPrice, m.decimals),
              };
            } catch {
              return { symbol: m.symbol, price: null };
            }
          }),
        );
        if (!cancelled) setTickers(withPrices);
      } catch {
        /* markets unavailable — leave ticker empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav className="flex h-12 flex-shrink-0 items-center gap-0 border-b border-border bg-panel px-4 z-50">
      <Link href="/markets" className="mr-8 flex items-center gap-1.5">
        <Square className="size-4 fill-primary text-primary" />
        <span className="text-[15px] font-semibold tracking-wider text-primary">
          PERPEX
        </span>
      </Link>

      <div className="flex flex-1 items-center gap-6 overflow-x-auto">
        {tickers.map((t) => (
          <Link
            key={t.symbol}
            href={`/trade/${t.symbol}`}
            className="flex flex-shrink-0 items-center gap-2"
          >
            <span className="text-[11px] font-medium text-t2">
              {t.symbol.replace("-PERP", "")}
            </span>
            <span className="font-mono text-xs text-foreground">
              {t.price !== null ? formatPrice(t.price) : "—"}
            </span>
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <DepositDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Wallet className="size-3.5" />
                  Deposit
                </Button>
              }
            />
            <span className="hidden text-xs text-t2 sm:inline">{username}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => setAuthOpen(true)}
          >
            Connect Wallet
          </Button>
        )}
      </div>
    </nav>
  );
}
