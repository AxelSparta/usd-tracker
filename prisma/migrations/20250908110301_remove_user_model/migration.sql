/*
  Warnings:

  - You are about to drop the column `ownerId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_ownerId_fkey";

-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "ownerId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."User";
