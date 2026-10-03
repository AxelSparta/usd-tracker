-- AlterTable
ALTER TABLE "CryptoTransaction" ADD COLUMN     "usdtSwapId" UUID;

-- AlterTable
ALTER TABLE "DolarTransaction" ADD COLUMN     "usdtSwapId" UUID;

-- CreateIndex
CREATE INDEX "CryptoTransaction_usdtSwapId_idx" ON "CryptoTransaction"("usdtSwapId");

-- CreateIndex
CREATE INDEX "DolarTransaction_usdtSwapId_idx" ON "DolarTransaction"("usdtSwapId");
