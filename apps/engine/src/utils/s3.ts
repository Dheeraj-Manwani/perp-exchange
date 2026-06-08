import { S3Client } from "bun";
import { logger } from "@repo/logger";
import { env } from "./env";
import { v4 as uuid } from "uuid";

const s3 = new S3Client({
  bucket: env.S3_BUCKET_NAME,
  region: env.AWS_REGION,
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
});

export const uploadToS3 = async (buffer: Buffer) => {
  const key = "100x/perp-exchange/snapshot-" + uuid();
  await s3.write(key, buffer);
  logger.info({ key, bytes: buffer.length }, "Uploaded snapshot blob to S3");
  return key;
};

export const readFromS3 = async (key: string) => {
  return await s3.file(key).bytes();
};
