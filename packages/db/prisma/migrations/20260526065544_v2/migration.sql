/*
  Warnings:

  - Made the column `price` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "slippage" INTEGER,
ALTER COLUMN "price" SET NOT NULL,
ALTER COLUMN "leverage" SET DEFAULT 1;
