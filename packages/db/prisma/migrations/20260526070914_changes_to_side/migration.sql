/*
  Warnings:

  - Changed the type of `side` on the `Order` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `side` on the `Position` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Side" AS ENUM ('LONG', 'SHORT');

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "side",
ADD COLUMN     "side" "Side" NOT NULL;

-- AlterTable
ALTER TABLE "Position" DROP COLUMN "side",
ADD COLUMN     "side" "Side" NOT NULL;

-- DropEnum
DROP TYPE "OrderSide";

-- DropEnum
DROP TYPE "PositionSide";
