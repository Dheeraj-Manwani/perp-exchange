import WebSocket from "ws";
import { logger } from "@repo/logger";
import { pushToQueue } from "./util/stream";
import type { MarketInfo } from "./util/market";

const prices = new Map<string, string>();

export function connectBinanceFeed(
  streams: string,
  feedMap: Map<string, MarketInfo>,
): () => void {
  let reconnecting = true;
  let activeWs: WebSocket | null = null;
  let activeInterval: NodeJS.Timeout | undefined;

  function connect() {
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/stream?streams=${streams}`,
    );
    activeWs = ws;

    ws.on("open", () => {
      logger.info("Binance feed connected");
      activeInterval = setInterval(() => pushToQueue(prices), 1000);
    });

    ws.on("message", (raw: Buffer) => {
      const { data } = JSON.parse(raw.toString()) as {
        data: { s: string; p: string };
      };
      const info = feedMap.get(data.s.toUpperCase());
      if (info) {
        const scale = 10 ** info.decimals;
        prices.set(
          info.market,
          Math.round(parseFloat(data.p) * scale).toString(),
        );
        console.log(
          "recieved from ws",
          info.market,
          Math.round(parseFloat(data.p) * scale).toString(),
        );
      }
    });

    ws.on("close", () => {
      clearInterval(activeInterval);
      if (reconnecting) {
        logger.info("Binance feed disconnected - reconnecting in 3s");
        setTimeout(connect, 3000);
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "Binance WS error");
      ws.terminate();
    });
  }

  connect();

  return function stop() {
    reconnecting = false;
    clearInterval(activeInterval);
    activeWs?.terminate();
  };
}
