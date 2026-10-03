-- CreateEnum
CREATE TYPE "OperationKind" AS ENUM ('TRADE_RESULT');

-- AlterTable
ALTER TABLE "CryptoTransaction" ADD COLUMN     "kind" "OperationKind",
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "DolarTransaction" ADD COLUMN     "kind" "OperationKind",
ADD COLUMN     "note" TEXT;
