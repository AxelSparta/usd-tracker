-- CreateTable
CREATE TABLE "PesosMovement" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "conversionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PesosMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PesosMovement_userId_date_idx" ON "PesosMovement"("userId", "date");

-- CreateIndex
CREATE INDEX "PesosMovement_conversionId_idx" ON "PesosMovement"("conversionId");

-- AddForeignKey
ALTER TABLE "PesosMovement" ADD CONSTRAINT "PesosMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

