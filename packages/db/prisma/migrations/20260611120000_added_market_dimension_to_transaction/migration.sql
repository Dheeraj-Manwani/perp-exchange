-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "marketId" UUID,
ADD COLUMN     "referenceId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_userId_type_createdAt_idx" ON "Transaction"("userId", "type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_userId_marketId_createdAt_idx" ON "Transaction"("userId", "marketId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
