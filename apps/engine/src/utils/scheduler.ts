import { Cron } from "croner";
import { logger } from "@repo/logger";
import { SnapshotService } from "../services/SnapshotService";

// snapshotting cron job
new Cron("*/5 * * * *", async () => {
  try {
    await SnapshotService.instance.uploadSnapshot();
  } catch (error) {
    logger.error({ error }, "Failed to upload engine snapshot");
  }
});

// Funding settlement is triggered externally by the market-data service
// at 00:00, 08:00, and 16:00 UTC via a "funding_settle" message on ENGINE_QUEUE.
