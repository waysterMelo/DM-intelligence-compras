/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updatedAt` to the `Quote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buyerCompanyId` to the `tax_reprocessing_jobs` table without a default value. This is not possible if the table is not empty.
  - Made the column `tenantId` on table `tax_reprocessing_jobs` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'MANAGER', 'ADMIN', 'SPECIALIST');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewReasonCode" AS ENUM ('LOW_CONFIDENCE', 'BLOCKED', 'HIGH_TAX_DELTA', 'RULE_CONFLICT', 'MANUAL_AUDIT_REQUESTED', 'DOCUMENT_MISMATCH', 'MISSING_CRITICAL_TAX_DATA');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('CALCULATION_ACCEPTED', 'CALCULATION_ADJUSTED', 'CALCULATION_REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ReviewSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'COMPLETED_ALL_SKIPPED';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pendingReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "TaxRuleCatalog" ADD COLUMN     "appliesTo" JSONB,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "severity" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'BUYER';

-- AlterTable
ALTER TABLE "fornecedores" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "tax_reprocessing_job_items" ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN     "buyerCompanyId" TEXT NOT NULL,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateTable
CREATE TABLE "tax_legal_basis" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lawType" TEXT NOT NULL,
    "lawNumber" TEXT,
    "article" TEXT,
    "paragraph" TEXT,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_legal_basis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_review_queue_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "reasonCode" "ReviewReasonCode" NOT NULL,
    "reasonText" TEXT,
    "severity" "ReviewSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" TEXT,
    "resolvedByUserId" TEXT,
    "oldSnapshotId" TEXT,
    "newSnapshotId" TEXT,
    "notes" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "tax_review_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_review_decisions" (
    "id" TEXT NOT NULL,
    "reviewItemId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "outcome" "ReviewOutcome" NOT NULL,
    "adjustedValues" JSONB,
    "explanation" TEXT,
    "reasonCode" "ReviewReasonCode",
    "severityAtDecision" TEXT,
    "ruleCodes" TEXT[],
    "legalBasisRef" TEXT,
    "itemStatusAtDecision" TEXT,
    "severitySnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "tax_review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DecisionRules" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_legal_basis_code_key" ON "tax_legal_basis"("code");

-- CreateIndex
CREATE INDEX "tax_review_queue_items_tenantId_status_idx" ON "tax_review_queue_items"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tax_review_queue_items_assignedToUserId_status_idx" ON "tax_review_queue_items"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "tax_review_queue_items_reasonCode_severity_idx" ON "tax_review_queue_items"("reasonCode", "severity");

-- CreateIndex
CREATE INDEX "tax_review_decisions_tenantId_outcome_idx" ON "tax_review_decisions"("tenantId", "outcome");

-- CreateIndex
CREATE INDEX "tax_review_decisions_reasonCode_idx" ON "tax_review_decisions"("reasonCode");

-- CreateIndex
CREATE UNIQUE INDEX "_DecisionRules_AB_unique" ON "_DecisionRules"("A", "B");

-- CreateIndex
CREATE INDEX "_DecisionRules_B_index" ON "_DecisionRules"("B");

-- AddForeignKey
ALTER TABLE "tax_review_queue_items" ADD CONSTRAINT "tax_review_queue_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_review_decisions" ADD CONSTRAINT "tax_review_decisions_reviewItemId_fkey" FOREIGN KEY ("reviewItemId") REFERENCES "tax_review_queue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionRules" ADD CONSTRAINT "_DecisionRules_A_fkey" FOREIGN KEY ("A") REFERENCES "tax_review_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionRules" ADD CONSTRAINT "_DecisionRules_B_fkey" FOREIGN KEY ("B") REFERENCES "TaxRuleCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
