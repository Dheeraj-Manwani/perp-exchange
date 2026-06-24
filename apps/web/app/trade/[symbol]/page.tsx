import { Navbar } from "@/components/navbar";
import { TradeProvider } from "@/components/trade/trade-context";
import { MarketHeader } from "@/components/trade/market-header";
import { CandlestickChart } from "@/components/trade/candlestick-chart";
import { OrderBook } from "@/components/trade/order-book";
import { OrderForm } from "@/components/trade/order-form";
import { BottomPanel } from "@/components/trade/bottom-panel";

export default async function TradePage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const decoded = decodeURIComponent(symbol).toUpperCase();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base">
      <Navbar />
      <TradeProvider symbol={decoded}>
        <MarketHeader />
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_240px_280px] overflow-hidden">
          <CandlestickChart />
          <OrderBook />
          <OrderForm />
        </div>
        <BottomPanel />
      </TradeProvider>
    </div>
  );
}
