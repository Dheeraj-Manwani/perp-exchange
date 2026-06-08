import { prisma } from "@repo/db";
import { logger } from "@repo/logger";
import { Exchange } from "../core/Exchange";
import { EngineSnapshot } from "../core/EngineSnapshot";
import { readFromS3, uploadToS3 } from "../utils/s3";
import { decodeSnapshot, encodeSnapshot } from "../utils/serialization";

export class SnapshotService {
  static readonly instance = new SnapshotService();

  private _lastRedisOrderEventId: string | undefined;

  private constructor() {}

  updateLastEventId(id: string): void {
    this._lastRedisOrderEventId = id;
  }

  async uploadSnapshot(): Promise<void> {
    if (!this._lastRedisOrderEventId) {
      logger.info("Skipping snapshot — no events processed yet");
      return;
    }

    const data = Exchange.instance.getSnapshotData();
    const { blob, checksum, sizeBytes } = await encodeSnapshot(data);
    const objectKey = await uploadToS3(blob);

    await prisma.orderbookSnapshots.create({
      data: {
        objectKey,
        checksum,
        sizeBytes,
        lastRedisOrderEventId: this._lastRedisOrderEventId,
      },
    });

    logger.info({ objectKey, sizeBytes }, "Uploaded engine snapshot");
  }

  async restoreLatestSnapshot(): Promise<{
    lastRedisOrderEventId: string;
  } | null> {
    const latest = await prisma.orderbookSnapshots.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!latest) {
      logger.info("No snapshot found — starting from a clean state");
      return null;
    }

    const bytes = await readFromS3(latest.objectKey);
    const snapshot = await decodeSnapshot<EngineSnapshot>(
      Buffer.from(bytes),
      latest.checksum,
    );

    Exchange.instance.restoreFromSnapshot(snapshot);
    this._lastRedisOrderEventId = latest.lastRedisOrderEventId;

    logger.info(
      {
        objectKey: latest.objectKey,
        lastRedisOrderEventId: latest.lastRedisOrderEventId,
      },
      "Restored engine state from snapshot",
    );

    return { lastRedisOrderEventId: latest.lastRedisOrderEventId };
  }
}
