-- AlterTable
ALTER TABLE "DolarTransaction" ADD COLUMN     "conversionId" UUID;

-- CreateIndex
CREATE INDEX "DolarTransaction_conversionId_idx" ON "DolarTransaction"("conversionId");

