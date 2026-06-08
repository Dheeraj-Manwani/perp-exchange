-- CreateTable
CREATE TABLE "OrderbookSnapshots" (
    "id" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRedisOrderEventId" TEXT NOT NULL,

    CONSTRAINT "OrderbookSnapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderbookSnapshots_createdAt_idx" ON "OrderbookSnapshots"("createdAt");
