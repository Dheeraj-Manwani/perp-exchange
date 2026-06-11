-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "maintenanceMarginBps" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "maxLeverage" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "minQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tickSize" TEXT NOT NULL DEFAULT '1';

-- CreateTable
CREATE TABLE "FundingRate" (
    "id" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "rateBps" TEXT NOT NULL,
    "markPrice" TEXT NOT NULL,
    "settledAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundingRate_marketId_settledAt_idx" ON "FundingRate"("marketId", "settledAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FundingRate_marketId_period_key" ON "FundingRate"("marketId", "period");

-- AddForeignKey
ALTER TABLE "FundingRate" ADD CONSTRAINT "FundingRate_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
