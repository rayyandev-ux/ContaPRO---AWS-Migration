ALTER TABLE "Payment" ADD COLUMN "flowToken" TEXT;

CREATE UNIQUE INDEX "Payment_flowToken_key" ON "Payment"("flowToken") WHERE "flowToken" IS NOT NULL;