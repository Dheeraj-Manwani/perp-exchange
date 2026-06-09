import { logger } from "@repo/logger";
import { EngineCommandType } from "@repo/schema";
import { env } from "./env";
import { publisher } from "./redis-client";

const FUNDING_HOURS_UTC = new Set([0, 8, 16]);
const CHECK_INTERVAL_MS = 30_000; // check every 30 s

/**
 * Returns the ISO-8601 period ID for the current 8-hour settlement boundary
 * if `now` falls within the first minute of that boundary, otherwise null.
 */
function getFundingPeriod(now: Date): string | null {
  const h = now.getUTCHours();
  if (!FUNDING_HOURS_UTC.has(h) || now.getUTCMinutes() !== 0) return null;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, 0, 0, 0),
  ).toISOString();
}

/**
 * Starts the funding-settlement dispatch loop.
 * Every 30 s it checks whether we are at a funding boundary (minute 0 of
 * 00:00 / 08:00 / 16:00 UTC). If so — and we haven't already dispatched this
 * period — it pushes a `funding_settle` command to ENGINE_QUEUE.
 *
 * The period ISO string is the idempotency key; the engine's `claimEvent` guard
 * in the DB writer prevents double-settlement even if the message is delivered twice.
 */
export function startFundingDispatch(): void {
  let lastDispatchedPeriod = "";

  setInterval(async () => {
    const period = getFundingPeriod(new Date());
    if (!period || period === lastDispatchedPeriod) return;

    lastDispatchedPeriod = period;

    try {
      await publisher.xAdd(
        env.ENGINE_QUEUE,
        "*",
        {
          data: JSON.stringify({
            type: "funding_settle" as EngineCommandType,
            payload: { period },
          }),
        },
        {
          TRIM: {
            strategy: "MINID",
            strategyModifier: "~",
            threshold: Date.now() - 90 * 24 * 60 * 60 * 1000,
          },
        },
      );
      logger.info({ period }, "Funding settlement dispatched");
    } catch (err) {
      logger.error({ err, period }, "Failed to dispatch funding settlement");
    }
  }, CHECK_INTERVAL_MS);
}
