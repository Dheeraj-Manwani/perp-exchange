-- CreateTable
CREATE TABLE "ProcessedEngineEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEngineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessedEngineEvent_createdAt_idx" ON "ProcessedEngineEvent"("createdAt");
