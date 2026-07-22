-- CreateEnum
CREATE TYPE "ReviewTriggerType" AS ENUM ('BLOCKED', 'LOW_CONFIDENCE', 'HIGH_TAX_DELTA', 'RULE_CONFLICT', 'MISSING_DATA', 'MANUAL_REQUEST');

-- CreateTable
CREATE TABLE "tax_review_thresholds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "triggerType" "ReviewTriggerType" NOT NULL,
    "minTaxAmount" DOUBLE PRECISION,
    "deltaPercent" DOUBLE PRECISION,
    "severity" "ReviewSeverity" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_review_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_review_thresholds_tenantId_triggerType_key" ON "tax_review_thresholds"("tenantId", "triggerType");
