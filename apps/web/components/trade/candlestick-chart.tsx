"use client";

import * as React from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";

import { useTrade } from "./trade-context";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function generateCandles(count: number, basePrice: number): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice * 0.97;
  const startTime = Math.floor(Date.now() / 1000) - count * 3600;
  for (let i = 0; i < count; i++) {
    const volatility = price * 0.008;
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = Math.max(open + change, open * 0.985);
    const high = Math.max(open, close) + Math.random() * volatility * 0.6;
    const low = Math.min(open, close) - Math.random() * volatility * 0.6;
    candles.push({
      time: startTime + i * 3600,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: 50 + Math.random() * 300,
    });
    price = close;
  }
  return candles;
}

export function CandlestickChart() {
  const { markPrice } = useTrade();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const candleRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = React.useRef<ISeriesApi<"Histogram"> | null>(null);
  const [timeframe, setTimeframe] = React.useState("1H");
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0B0B0E" },
        textColor: "#7A7A8C",
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "#1E1E28" },
        horzLines: { color: "#1E1E28" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#24242E" },
      timeScale: {
        borderColor: "#24242E",
        timeVisible: true,
        secondsVisible: false,
      },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00C076",
      downColor: "#FF3A5C",
      borderVisible: false,
      wickUpColor: "#00C076",
      wickDownColor: "#FF3A5C",
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e && chartRef.current) {
        chartRef.current.resize(e.contentRect.width, e.contentRect.height);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      seeded.current = false;
    };
  }, []);

  // Seed candles once we have a base price, and on timeframe change.
  React.useEffect(() => {
    const base = markPrice ?? 100;
    if (!candleRef.current || !volumeRef.current) return;
    if (seeded.current && markPrice === null) return;
    const candles = generateCandles(120, base);
    candleRef.current.setData(
      candles.map(
        (c): CandlestickData => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }),
      ),
    );
    volumeRef.current.setData(
      candles.map(
        (c): HistogramData => ({
          time: c.time as Time,
          value: c.volume,
          color:
            c.close >= c.open
              ? "rgba(245,179,0,0.25)"
              : "rgba(255,58,92,0.25)",
        }),
      ),
    );
    chartRef.current?.timeScale().fitContent();
    seeded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, markPrice !== null]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-base">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={cn(
              "rounded px-2.5 py-1 text-xs transition-colors",
              timeframe === tf
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-t2 hover:bg-elevated",
            )}
          >
            {tf}
          </button>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
