import { logger } from "@repo/logger";
import {
  EngineCommandType,
  IndexPriceChangePayload,
  INDEX_PRICE_CACHE_KEY,
} from "@repo/schema";
import { publisher } from "./redis-client";
import { env } from "./env";

const lastSentPrices = new Map<string, string>();
let lastFullSnapshotAt = 0;
const SNAPSHOT_INTERVAL_MS = 30_000;

/** Latest-price cache read by the API for GET /markets/:symbol/index-price */
async function cacheIndexPrices(prices: Map<string, string>, now: number) {
  const fields: Record<string, string> = {};
  for (const [market, price] of prices) {
    fields[market] = JSON.stringify({ price, updatedAt: now });
  }
  await publisher
    .hSet(INDEX_PRICE_CACHE_KEY, fields)
    .catch((err) => logger.error({ err }, "Index price cache write failed"));
}

export async function pushToQueue(prices: Map<string, string>) {
  if (prices.size === 0) return;

  const now = Date.now();
  await cacheIndexPrices(prices, now);
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
    payload: {
      marketPrices: Object.fromEntries(pricesToSend),
    } as IndexPriceChangePayload,
  };

  console.log("sending to queue ", data);

  await publisher
    .xAdd(
      env.ENGINE_QUEUE,
      "*",
      { data: JSON.stringify(data) },
      {
        TRIM: {
          strategy: "MINID",
          strategyModifier: "~",
          threshold: Date.now() - 90 * 24 * 60 * 60 * 1000,
        },
      },
    )
    .catch((err) => logger.error({ err }, "Queue push failed"));
}
