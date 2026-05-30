import { logger } from "@repo/logger";
import { EngineCommandType } from "@repo/schema";
import { publisher } from "./redis-client";
import { env } from "./env";

const lastSentPrices = new Map<string, string>();
let lastFullSnapshotAt = 0;
const SNAPSHOT_INTERVAL_MS = 30_000;

export async function pushToQueue(prices: Map<string, string>) {
  if (prices.size === 0) return;

  const now = Date.now();
  const sendAll = now - lastFullSnapshotAt >= SNAPSHOT_INTERVAL_MS;

  const pricesToSend = new Map<string, string>();
  for (const [market, price] of prices) {
    if (sendAll || lastSentPrices.get(market) !== price) {
      pricesToSend.set(market, price);
      lastSentPrices.set(market, price);
    }
  }

  if (pricesToSend.size === 0) return;
  if (sendAll) lastFullSnapshotAt = now;

  const data = {
    type: "index_price_update" as EngineCommandType,
    payload: { marketPrices: Object.fromEntries(pricesToSend) },
  };

  console.log("sending to queue ", data);

  await publisher
    .xAdd(
      env.ENGINE_QUEUE,
      "*",
      { data: JSON.stringify(data) },
      { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 100 } },
    )
    .catch((err) => logger.error({ err }, "Queue push failed"));
}
