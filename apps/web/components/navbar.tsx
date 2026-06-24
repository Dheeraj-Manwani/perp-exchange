"use client";

import * as React from "react";
import Link from "next/link";
import {
  Square,
  Wallet,
  LogOut,
  LineChart,
  ArrowDownToLine,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DepositDialog } from "@/components/deposit-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import {
  api,
  type Market,
  type MarkPrice,
  type AccountSummary,
} from "@/lib/api";
import { scaledToNumber, formatPrice, formatUsd } from "@/lib/format";

interface Ticker {
  symbol: string;
  price: number | null;
}

// USD ledger asset uses 2 decimals (matches /onramp scaling).
const USD_DECIMALS = 2;

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
          <AccountMenu username={username ?? "trader"} onSignOut={signOut} />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => setAuthOpen(true)}
          >
            Sign In
          </Button>
        )}
      </div>
    </nav>
  );
}

function AccountMenu({
  username,
  onSignOut,
}: {
  username: string;
  onSignOut: () => void;
}) {
  const [summary, setSummary] = React.useState<AccountSummary | null>(null);
  const [loadErr, setLoadErr] = React.useState(false);
  const [depositOpen, setDepositOpen] = React.useState(false);

  const loadSummary = React.useCallback(async () => {
    try {
      const s = await api.getAccountSummary();
      setSummary(s);
      setLoadErr(false);
    } catch {
      setSummary(null);
      setLoadErr(true);
    }
  }, []);

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const initials = username.slice(0, 2).toUpperCase();
  const equity = summary ? scaledToNumber(summary.equity, USD_DECIMALS) : null;
  const available = summary
    ? scaledToNumber(summary.availableMargin, USD_DECIMALS)
    : null;
  const used = summary
    ? scaledToNumber(summary.usedMargin, USD_DECIMALS)
    : null;
  const pnl = summary
    ? scaledToNumber(summary.unrealisedPnl, USD_DECIMALS)
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-full pr-1.5 outline-none transition-colors hover:bg-elevated">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
              {initials}
            </span>
            <ChevronDown className="size-3.5 text-t2" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="min-w-64">
          {/* Identity */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/30">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {username}
              </div>
              <div className="text-[11px] text-t3">Perp account</div>
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Balance */}
          <DropdownMenuLabel>Account value</DropdownMenuLabel>
          <div className="px-2 pb-1">
            <div className="font-mono text-lg font-semibold text-foreground">
              {equity !== null ? `$${formatUsd(equity)}` : "—"}
            </div>
            {loadErr ? (
              <div className="text-[11px] text-down">Engine unavailable</div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-1 px-2 pb-2">
            <Stat label="Available" value={available} />
            <Stat label="Used margin" value={used} />
            <StatPnl label="Unrealised PnL" value={pnl} />
          </div>

          <DropdownMenuSeparator />

          {/* Actions */}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setDepositOpen(true);
            }}
          >
            <ArrowDownToLine />
            Deposit funds
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Wallet />
            Withdraw
            <span className="ml-auto text-[10px] text-t3">soon</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/markets">
              <LineChart />
              Markets
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={onSignOut}
            className="text-down focus:text-down [&_svg]:text-down"
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        onDeposited={loadSummary}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-sm bg-elevated px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-t3">{label}</div>
      <div className="font-mono text-xs text-foreground">
        {value !== null ? `$${formatUsd(value)}` : "—"}
      </div>
    </div>
  );
}

function StatPnl({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="col-span-2 rounded-sm bg-elevated px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-t3">{label}</div>
      <div
        className={
          "font-mono text-xs " +
          (value === null ? "text-foreground" : value >= 0 ? "text-up" : "text-down")
        }
      >
        {value !== null
          ? `${value >= 0 ? "+" : "-"}$${formatUsd(Math.abs(value))}`
          : "—"}
      </div>
    </div>
  );
}
