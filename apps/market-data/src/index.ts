import { logger } from "@repo/logger";
import { getMarketFeedMap } from "./util/market";
import { connectRedis, disconnectRedis } from "./util/redis-client";
import { connectBinanceFeed } from "./ws";
import type { MarketInfo } from "./util/market";

const buildStreams = (map: Map<string, MarketInfo>) =>
  [...map.keys()].map((s) => `${s.toLowerCase()}@aggTrade`).join("/");

async function main() {
  await connectRedis();
  const feedMap = await getMarketFeedMap();

  if (feedMap.size === 0) {
    throw new Error("No active Binance markets found");
  }

  const stopFeed = connectBinanceFeed(buildStreams(feedMap), feedMap);

  async function shutdown() {
    logger.info("Shutting down market-data service");
    stopFeed();
    await disconnectRedis();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
