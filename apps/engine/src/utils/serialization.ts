import { Packr, Unpackr } from "msgpackr";
import { createHash } from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface EncodedSnapshot {
  blob: Buffer;
  checksum: string;
  sizeBytes: number;
}
const COMPRESSION_LEVEL = 6;
const packr = new Packr({ useRecords: false, bundleStrings: true });
const unpackr = new Unpackr({ useRecords: false, bundleStrings: true });

export async function encodeSnapshot<T>(data: T): Promise<EncodedSnapshot> {
  const packed = packr.pack(data);
  const blob = await gzipAsync(packed, { level: COMPRESSION_LEVEL });

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

  const decompressed = await gunzipAsync(blob);
  return unpackr.unpack(decompressed) as T;
}
