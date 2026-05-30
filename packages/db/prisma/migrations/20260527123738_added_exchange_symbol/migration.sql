-- CreateTable
CREATE TABLE "ExchangeSymbol" (
    "id" UUID NOT NULL,
    "exchange" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "marketId" UUID NOT NULL,

    CONSTRAINT "ExchangeSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeSymbol_exchange_marketId_key" ON "ExchangeSymbol"("exchange", "marketId");

-- AddForeignKey
ALTER TABLE "ExchangeSymbol" ADD CONSTRAINT "ExchangeSymbol_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
