-- Múltiples portafolios: cada operación pertenece a un portafolio del usuario.
-- Los usuarios existentes reciben un portafolio "Principal" con todas sus operaciones.

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Portfolio_userId_createdAt_idx" ON "Portfolio"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Datos: un portafolio "Principal" por usuario (gen_random_uuid es nativo desde Postgres 13)
INSERT INTO "Portfolio" ("id", "userId", "name", "updatedAt")
SELECT gen_random_uuid(), "id", 'Principal', CURRENT_TIMESTAMP FROM "User";

-- AlterTable: la columna nace nullable, se completa y recién después pasa a NOT NULL
ALTER TABLE "DolarTransaction" ADD COLUMN "portfolioId" UUID;
ALTER TABLE "CryptoTransaction" ADD COLUMN "portfolioId" UUID;
ALTER TABLE "PesosMovement" ADD COLUMN "portfolioId" UUID;
ALTER TABLE "CedearTransaction" ADD COLUMN "portfolioId" UUID;

UPDATE "DolarTransaction" t SET "portfolioId" = p."id" FROM "Portfolio" p WHERE p."userId" = t."userId";
UPDATE "CryptoTransaction" t SET "portfolioId" = p."id" FROM "Portfolio" p WHERE p."userId" = t."userId";
UPDATE "PesosMovement" t SET "portfolioId" = p."id" FROM "Portfolio" p WHERE p."userId" = t."userId";
UPDATE "CedearTransaction" t SET "portfolioId" = p."id" FROM "Portfolio" p WHERE p."userId" = t."userId";

ALTER TABLE "DolarTransaction" ALTER COLUMN "portfolioId" SET NOT NULL;
ALTER TABLE "CryptoTransaction" ALTER COLUMN "portfolioId" SET NOT NULL;
ALTER TABLE "PesosMovement" ALTER COLUMN "portfolioId" SET NOT NULL;
ALTER TABLE "CedearTransaction" ALTER COLUMN "portfolioId" SET NOT NULL;

-- DropIndex
DROP INDEX "DolarTransaction_userId_dolarOption_date_idx";
DROP INDEX "CryptoTransaction_userId_coinId_date_idx";
DROP INDEX "PesosMovement_userId_date_idx";
DROP INDEX "CedearTransaction_userId_ticker_date_idx";

-- CreateIndex
CREATE INDEX "DolarTransaction_portfolioId_dolarOption_date_idx" ON "DolarTransaction"("portfolioId", "dolarOption", "date");
CREATE INDEX "CryptoTransaction_portfolioId_coinId_date_idx" ON "CryptoTransaction"("portfolioId", "coinId", "date");
CREATE INDEX "PesosMovement_portfolioId_date_idx" ON "PesosMovement"("portfolioId", "date");
CREATE INDEX "CedearTransaction_portfolioId_ticker_date_idx" ON "CedearTransaction"("portfolioId", "ticker", "date");

-- AddForeignKey
ALTER TABLE "DolarTransaction" ADD CONSTRAINT "DolarTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CryptoTransaction" ADD CONSTRAINT "CryptoTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PesosMovement" ADD CONSTRAINT "PesosMovement_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CedearTransaction" ADD CONSTRAINT "CedearTransaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
