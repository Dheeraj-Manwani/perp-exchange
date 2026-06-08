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
