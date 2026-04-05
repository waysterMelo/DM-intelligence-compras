/*
  Warnings:

  - You are about to drop the column `disallowedCreditsJson` on the `quote_tax_snapshots` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TaxConfidenceLevel" AS ENUM ('ESTIMATED', 'VALIDATED_BY_REGISTRATION', 'VALIDATED_BY_DOCUMENT', 'BLOCKED', 'EXPERT_REVIEWED');

-- CreateEnum
CREATE TYPE "TaxCalculationStatus" AS ENUM ('PENDING', 'SUCCESS', 'BLOCKED', 'IN_REVIEW');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "lastTaxCalculatedAt" TIMESTAMP(3),
ADD COLUMN     "lastTaxEngineVersion" TEXT,
ADD COLUMN     "lastTaxSnapshotId" TEXT,
ADD COLUMN     "taxCalculationStatus" "TaxCalculationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "taxConfidenceLevel" "TaxConfidenceLevel" NOT NULL DEFAULT 'ESTIMATED';

-- AlterTable
ALTER TABLE "quote_tax_snapshots" DROP COLUMN "disallowedCreditsJson",
ADD COLUMN     "calculationStatus" "TaxCalculationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "confidenceLevel" "TaxConfidenceLevel" NOT NULL DEFAULT 'ESTIMATED',
ADD COLUMN     "decisionSummaryJson" JSONB,
ADD COLUMN     "ruleCodesJson" JSONB;

-- CreateTable
CREATE TABLE "TaxRuleCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRuleCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleCatalog_code_key" ON "TaxRuleCatalog"("code");
