-- CreateTable
CREATE TABLE "PlanSetting" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "flowPlanId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanSetting_period_key" ON "PlanSetting"("period");
