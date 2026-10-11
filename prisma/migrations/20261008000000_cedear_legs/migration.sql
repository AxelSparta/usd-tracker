-- AlterTable
ALTER TABLE "DolarTransaction" ADD COLUMN     "cedearId" UUID;

-- AlterTable
ALTER TABLE "PesosMovement" ADD COLUMN     "cedearId" UUID;

-- CreateIndex
CREATE INDEX "DolarTransaction_cedearId_idx" ON "DolarTransaction"("cedearId");

-- CreateIndex
CREATE INDEX "PesosMovement_cedearId_idx" ON "PesosMovement"("cedearId");
