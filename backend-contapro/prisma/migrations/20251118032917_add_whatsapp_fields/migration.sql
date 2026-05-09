/*
  Warnings:

  - A unique constraint covering the columns `[whatsappPhone]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappLinkedAt" TIMESTAMP(3),
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappPhone_key" ON "User"("whatsappPhone");
