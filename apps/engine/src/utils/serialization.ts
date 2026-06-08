import { Packr, Unpackr } from "msgpackr";
import { compress, decompress } from "@mongodb-js/zstd";
import { createHash } from "node:crypto";

export interface EncodedSnapshot {
  blob: Buffer;
  checksum: string;
  sizeBytes: number;
}
const ZSTD_LEVEL = 3;
const packr = new Packr({ useRecords: false, bundleStrings: true });
const unpackr = new Unpackr({ useRecords: false, bundleStrings: true });

export async function encodeSnapshot<T>(data: T): Promise<EncodedSnapshot> {
  const packed = packr.pack(data);
  const blob = await compress(packed, ZSTD_LEVEL);

  const checksum = createHash("sha256").update(blob).digest("hex");
  const sizeBytes = blob.length;

  return { blob, checksum, sizeBytes };
}

export async function decodeSnapshot<T>(
  blob: Buffer,
  expectedChecksum: string,
): Promise<T> {
  const actual = createHash("sha256").update(blob).digest("hex");
  if (actual !== expectedChecksum) {
    throw new Error(
      `Snapshot checksum mismatch. expected=${expectedChecksum} actual=${actual}`,
    );
  }

  const decompressed = await decompress(blob);
  return unpackr.unpack(decompressed) as T;
}
