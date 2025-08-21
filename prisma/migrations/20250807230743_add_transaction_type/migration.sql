/*
  Warnings:

  - Added the required column `type` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usdPrice` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN     "type" "public"."TransactionType" NOT NULL,
ADD COLUMN     "usdPrice" DOUBLE PRECISION NOT NULL;
