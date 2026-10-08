-- CreateEnum
CREATE TYPE "CedearCurrency" AS ENUM ('ARS', 'CCL');

-- CreateTable
CREATE TABLE "CedearTransaction" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" "CedearCurrency" NOT NULL,
    "fxRate" DECIMAL(65,30) NOT NULL,
    "fee" DECIMAL(65,30),
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CedearTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CedearTransaction_userId_ticker_date_idx" ON "CedearTransaction"("userId", "ticker", "date");

-- AddForeignKey
ALTER TABLE "CedearTransaction" ADD CONSTRAINT "CedearTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

