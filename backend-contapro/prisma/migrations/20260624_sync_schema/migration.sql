-- CreateEnum
CREATE TYPE "BudgetTarget" AS ENUM ('GENERAL', 'CATEGORY');

-- AlterEnum
ALTER TYPE "Plan" ADD VALUE 'LIFETIME';
ALTER TYPE "Plan" ADD VALUE 'BUSINESS';
ALTER TYPE "Plan" ADD VALUE 'QUARTERLY';

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'BUDGET';
ALTER TYPE "SourceType" ADD VALUE 'SAVINGS';

-- ============================================================
-- AlterTable "User": add missing columns
-- ============================================================
ALTER TABLE "User" ADD COLUMN "defaultPaymentMethodId" TEXT;
ALTER TABLE "User" ADD COLUMN "tutorialSeen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "flowCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "flowSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "flowSubscriptionPlanId" TEXT;
ALTER TABLE "User" ADD COLUMN "flowCardLast4" TEXT;
ALTER TABLE "User" ADD COLUMN "flowCardType" TEXT;
ALTER TABLE "User" ADD COLUMN "flowPendingPlan" TEXT;
ALTER TABLE "User" ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'STRIPE';
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "birthDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'es';
ALTER TABLE "User" ADD COLUMN "extraProfileSlots" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "antExpenseCountAlert" INTEGER;
ALTER TABLE "User" ADD COLUMN "antExpenseEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "antExpenseLimit" DOUBLE PRECISION NOT NULL DEFAULT 50.0;
ALTER TABLE "User" ADD COLUMN "antExpenseStreakAlert" INTEGER;
ALTER TABLE "User" ADD COLUMN "notifyEmailExpenseWhatsApp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyEmailExpenseTelegram" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "reportFrequency" TEXT NOT NULL DEFAULT 'DAILY';
ALTER TABLE "User" ADD COLUMN "onboardingData" JSONB;
ALTER TABLE "User" ADD COLUMN "botMessageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "botMessageResetAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "extraEmailSlots" INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- AlterTable "Budget": add missing columns and update constraint
-- ============================================================
ALTER TABLE "Budget" ADD COLUMN "name" TEXT;
ALTER TABLE "Budget" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Budget" ADD COLUMN "target" "BudgetTarget" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Budget" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Budget" ALTER COLUMN "alertThreshold" SET DEFAULT 0.8;

DROP INDEX "Budget_userId_year_month_key";
CREATE UNIQUE INDEX "Budget_userId_profileId_year_month_target_categoryId_key"
  ON "Budget"("userId", "profileId", "year", "month", "target", "categoryId");

-- ============================================================
-- AlterTable "Category": add profileId, update unique constraint
-- ============================================================
ALTER TABLE "Category" ADD COLUMN "profileId" TEXT;

DROP INDEX "Category_name_userId_key";
CREATE UNIQUE INDEX "Category_name_userId_profileId_key"
  ON "Category"("name", "userId", "profileId");

-- ============================================================
-- AlterTable "Document": add profileId
-- ============================================================
ALTER TABLE "Document" ADD COLUMN "profileId" TEXT;

-- ============================================================
-- AlterTable "Expense": add missing columns
-- ============================================================
ALTER TABLE "Expense" ADD COLUMN "emitterIdNumber" TEXT;
ALTER TABLE "Expense" ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "amountNative" DOUBLE PRECISION;
ALTER TABLE "Expense" ADD COLUMN "exchangeRate" DOUBLE PRECISION;
ALTER TABLE "Expense" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- ============================================================
-- AlterTable "Payment": add missing columns
-- ============================================================
ALTER TABLE "Payment" ADD COLUMN "flowOrder" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "stripeSessionId" TEXT;

CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE UNIQUE INDEX "Payment_stripeSessionId_key" ON "Payment"("stripeSessionId");

-- ============================================================
-- AlterTable "PlanSetting": add stripePriceId
-- ============================================================
ALTER TABLE "PlanSetting" ADD COLUMN "stripePriceId" TEXT;

-- ============================================================
-- CreateTable "Profile"
-- ============================================================
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "avatar" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Profile_userId_name_key" ON "Profile"("userId", "name");

-- ============================================================
-- CreateTable "SavingsGoal"
-- ============================================================
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "currentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "deadline" TIMESTAMP(3),
    "icon" TEXT,
    "color" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileId" TEXT,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- CreateTable "SavingsTransaction"
-- ============================================================
CREATE TABLE "SavingsTransaction" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsTransaction_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- CreateTable "Coupon"
-- ============================================================
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- ============================================================
-- CreateTable "CouponRedemption"
-- ============================================================
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CouponRedemption_userId_couponId_key" ON "CouponRedemption"("userId", "couponId");

-- ============================================================
-- CreateTable "PaymentMethod"
-- ============================================================
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cardLast4" TEXT,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileId" TEXT,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethod_userId_profileId_name_key" ON "PaymentMethod"("userId", "profileId", "name");

-- ============================================================
-- CreateTable "PromoCode"
-- ============================================================
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedById" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- ============================================================
-- CreateTable "BudgetLog"
-- ============================================================
CREATE TABLE "BudgetLog" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "previousTotal" DOUBLE PRECISION NOT NULL,
    "newTotal" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT,

    CONSTRAINT "BudgetLog_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- CreateTable "EmailIntegration"
-- ============================================================
CREATE TABLE "EmailIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastSync" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settings" JSONB,

    CONSTRAINT "EmailIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailIntegration_userId_email_key" ON "EmailIntegration"("userId", "email");

-- ============================================================
-- CreateTable "PendingExpense"
-- ============================================================
CREATE TABLE "PendingExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "description" TEXT,
    "merchant" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "rawText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING_USER',
    "aiAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "screenshotPath" TEXT,

    CONSTRAINT "PendingExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingExpense_userId_sourceId_key" ON "PendingExpense"("userId", "sourceId");

-- ============================================================
-- CreateTable "AgentContext"
-- ============================================================
CREATE TABLE "AgentContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentContext_userId_key" ON "AgentContext"("userId");

-- ============================================================
-- CreateTable "ChatMemory"
-- ============================================================
CREATE TABLE "ChatMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMemory_userId_idx" ON "ChatMemory"("userId");

-- ============================================================
-- CreateTable "Income"
-- ============================================================
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "paymentMethodId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "amountNative" DOUBLE PRECISION,
    "exchangeRate" DOUBLE PRECISION,
    "description" TEXT,
    "category" TEXT,
    "categoryId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- CreateTable "SavedView"
-- ============================================================
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedView_userId_name_key" ON "SavedView"("userId", "name");

-- ============================================================
-- Update Foreign Keys: RESTRICT → CASCADE where needed
-- ============================================================
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Analysis" DROP CONSTRAINT "Analysis_documentId_fkey";
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Budget" DROP CONSTRAINT "Budget_userId_fkey";
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT "Expense_userId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Add new Foreign Keys
-- ============================================================
-- User → PaymentMethod (default)
ALTER TABLE "User" ADD CONSTRAINT "User_defaultPaymentMethodId_fkey"
  FOREIGN KEY ("defaultPaymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Profile
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Budget → Profile, Category
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Category → Profile
ALTER TABLE "Category" ADD CONSTRAINT "Category_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_userId_fkey";
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document → Profile
ALTER TABLE "Document" ADD CONSTRAINT "Document_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Expense → PaymentMethod, Profile
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PaymentMethod → User, Profile
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SavingsGoal
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SavingsTransaction
ALTER TABLE "SavingsTransaction" ADD CONSTRAINT "SavingsTransaction_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CouponRedemption
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PromoCode
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_redeemedById_fkey"
  FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BudgetLog
ALTER TABLE "BudgetLog" ADD CONSTRAINT "BudgetLog_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLog" ADD CONSTRAINT "BudgetLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLog" ADD CONSTRAINT "BudgetLog_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailIntegration
ALTER TABLE "EmailIntegration" ADD CONSTRAINT "EmailIntegration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PendingExpense
ALTER TABLE "PendingExpense" ADD CONSTRAINT "PendingExpense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentContext
ALTER TABLE "AgentContext" ADD CONSTRAINT "AgentContext_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChatMemory
ALTER TABLE "ChatMemory" ADD CONSTRAINT "ChatMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Income
ALTER TABLE "Income" ADD CONSTRAINT "Income_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SavedView
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Drop legacy table not in schema
-- ============================================================
DROP TABLE IF EXISTS "CategoryBudget";
