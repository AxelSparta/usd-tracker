-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "FeeCurrency" AS ENUM ('USD', 'COIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DolarTransaction" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "dolarOption" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "dollarsAmount" DECIMAL(65,30) NOT NULL,
    "pesosAmount" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DolarTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoTransaction" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "priceUsd" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "feeAmount" DECIMAL(65,30),
    "feeCurrency" "FeeCurrency",
    "swapId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DolarTransaction_userId_dolarOption_date_idx" ON "DolarTransaction"("userId", "dolarOption", "date");

-- CreateIndex
CREATE INDEX "CryptoTransaction_userId_coinId_date_idx" ON "CryptoTransaction"("userId", "coinId", "date");

-- CreateIndex
CREATE INDEX "CryptoTransaction_swapId_idx" ON "CryptoTransaction"("swapId");

-- AddForeignKey
ALTER TABLE "DolarTransaction" ADD CONSTRAINT "DolarTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoTransaction" ADD CONSTRAINT "CryptoTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

