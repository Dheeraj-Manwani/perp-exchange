"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { useTrade } from "./trade-context";
import { api, type FundingRate } from "@/lib/api";
import { formatPrice, bpsToPct, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MarketHeader() {
  const { symbol, market, markPrice, indexPrice } = useTrade();
  const [funding, setFunding] = React.useState<FundingRate | null>(null);
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const [flash, setFlash] = React.useState("");
  const prevPrice = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!market) return;
    let cancelled = false;
    api
      .getFundingRate(market.symbol)
      .then((f) => !cancelled && setFunding(f))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [market]);

  // Funding countdown.
  React.useEffect(() => {
    if (!funding?.nextFundingTime) return;
    const tick = () => {
      const diff = new Date(funding.nextFundingTime).getTime() - Date.now();
      setCountdown(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [funding]);

  // Price flash.
  React.useEffect(() => {
    if (markPrice === null) return;
    if (prevPrice.current !== null && markPrice !== prevPrice.current) {
      setFlash(markPrice > prevPrice.current ? "flash-green" : "flash-red");
      const t = setTimeout(() => setFlash(""), 400);
      prevPrice.current = markPrice;
      return () => clearTimeout(t);
    }
    prevPrice.current = markPrice;
  }, [markPrice]);

  const fmtCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  };

  const fundingPct = funding ? bpsToPct(funding.rateBps) : null;

  return (
    <div className="flex h-16 flex-shrink-0 items-center gap-7 overflow-x-auto border-b border-border bg-panel px-4">
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <Link href="/markets" className="text-t2 hover:text-foreground">
          <ChevronLeft className="size-4" />
        </Link>
        <span className="text-lg font-bold text-foreground">{symbol}</span>
      </div>

      <div className="flex-shrink-0">
        <div
          className={cn(
            "font-mono text-[22px] font-semibold text-up transition-colors",
            flash,
          )}
        >
          {markPrice !== null ? formatPrice(markPrice) : "—"}
        </div>
      </div>

      <Stat
        label="Index"
        value={indexPrice !== null ? formatPrice(indexPrice) : "—"}
      />
      <Stat label="Max Leverage" value={market ? `${market.maxLeverage}x` : "—"} />
      <Stat
        label="Tick Size"
        value={market ? market.tickSize : "—"}
        mono
      />
      <Stat label="Min Qty" value={market ? String(market.minQty) : "—"} mono />

      <div className="ml-auto flex-shrink-0 text-right">
        <div className="mb-0.5 text-[10px] uppercase tracking-wide text-t2">
          Funding{" "}
          {countdown !== null ? `/ ${fmtCountdown(countdown)}` : ""}
        </div>
        <div className="font-mono text-[13px] font-semibold text-yellow">
          {fundingPct !== null ? formatPct(fundingPct, 4) : "—"}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex-shrink-0">
      <div className="mb-0.5 text-[10px] uppercase tracking-wide text-t2">
        {label}
      </div>
      <div
        className={cn("text-[13px] text-foreground", mono && "font-mono")}
      >
        {value}
      </div>
    </div>
  );
}
