/*
  Warnings:

  - Added the required column `checksum` to the `OrderbookSnapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeBytes` to the `OrderbookSnapshots` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderbookSnapshots" ADD COLUMN     "checksum" TEXT NOT NULL,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL;
