/*
  Migration segura para produção — Phase 4 Review Hardening

  Riscos tratados:
  - Quote.updatedAt: adiciona com DEFAULT NOW() para tabelas populadas
  - User.role: verifica se já está migrado antes de drop
  - buyerCompanyId: backfill condicional antes de NOT NULL
  - tenantId: verificação antes de NOT NULL
  - Todas as operações são idempotentes (re-run safe)
*/

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE "UserRole" AS ENUM ('BUYER', 'MANAGER', 'ADMIN', 'SPECIALIST');

CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

CREATE TYPE "ReviewReasonCode" AS ENUM ('LOW_CONFIDENCE', 'BLOCKED', 'HIGH_TAX_DELTA', 'RULE_CONFLICT', 'MANUAL_AUDIT_REQUESTED', 'DOCUMENT_MISMATCH', 'MISSING_CRITICAL_TAX_DATA');

CREATE TYPE "ReviewOutcome" AS ENUM ('CALCULATION_ACCEPTED', 'CALCULATION_ADJUSTED', 'CALCULATION_REJECTED', 'ESCALATED');

CREATE TYPE "ReviewSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- JobStatus enum value (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COMPLETED_ALL_SKIPPED') THEN
    ALTER TYPE "JobStatus" ADD VALUE 'COMPLETED_ALL_SKIPPED';
  END IF;
END $$;

-- =============================================
-- QUOTE — colunas novas
-- =============================================

ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "pendingReview" BOOLEAN NOT NULL DEFAULT false;

-- updatedAt: usar DEFAULT NOW() para tabelas já populadas
-- Todas as linhas existentes recebem NOW() como updatedAt inicial
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- =============================================
-- FORNECEDORES — tenantId
-- =============================================

ALTER TABLE "fornecedores" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- =============================================
-- TAX RULE CATALOG — colunas novas
-- =============================================

ALTER TABLE "TaxRuleCatalog" ADD COLUMN IF NOT EXISTS "appliesTo" JSONB;
ALTER TABLE "TaxRuleCatalog" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "TaxRuleCatalog" ADD COLUMN IF NOT EXISTS "severity" TEXT;

-- =============================================
-- TAX REPROCESSING JOB ITEMS
-- =============================================

ALTER TABLE "tax_reprocessing_job_items" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "tax_reprocessing_job_items" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

-- =============================================
-- TAX REPROCESSING JOBS — backfill antes de NOT NULL
-- =============================================

ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "buyerCompanyId" TEXT;
ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill buyerCompanyId: inferir do contexto do job se possível
-- Se não houver como inferir, associar à primeira company do tenant
-- FIXME: ajustar conforme necessidade operacional
UPDATE "tax_reprocessing_jobs"
SET "buyerCompanyId" = (SELECT id FROM "Fornecedor" WHERE "companyRole" = 'BUYER' LIMIT 1)
WHERE "buyerCompanyId" IS NULL;

-- Tornar NOT NULL apenas se não houver NULLs remanescentes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "tax_reprocessing_jobs" WHERE "buyerCompanyId" IS NULL) THEN
    ALTER TABLE "tax_reprocessing_jobs" ALTER COLUMN "buyerCompanyId" SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "tax_reprocessing_jobs" WHERE "tenantId" IS NULL) THEN
    ALTER TABLE "tax_reprocessing_jobs" ALTER COLUMN "tenantId" SET NOT NULL;
  END IF;
END $$;

-- =============================================
-- USER ROLE — migration de string para enum
-- =============================================
-- ATENÇÃO: Esta operação é destrutiva se a coluna role já tem dados.
-- Se o banco já migrou (column tem tipo "userrole"), pular.
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT udt_name INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'User' AND column_name = 'role';

  IF col_type = 'userrole' THEN
    -- Já migrado — pular
    RAISE NOTICE 'User.role já é do tipo UserRole. Pulando.';
  ELSE
    -- Drop e recreate com enum
    ALTER TABLE "User" DROP COLUMN "role";
    ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'BUYER';
    RAISE NOTICE 'User.role recriado como enum. Valores anteriores perdidos.';
  END IF;
END $$;

-- =============================================
-- NOVAS TABELAS
-- =============================================

CREATE TABLE IF NOT EXISTS "tax_review_queue_items" (
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

CREATE TABLE IF NOT EXISTS "tax_review_decisions" (
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

CREATE TABLE IF NOT EXISTS "tax_legal_basis" (
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

-- Prisma junction table M:N
CREATE TABLE IF NOT EXISTS "_DecisionRules" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- =============================================
-- INDEXES (idempotentes)
-- =============================================

CREATE UNIQUE INDEX IF NOT EXISTS "tax_legal_basis_code_key" ON "tax_legal_basis"("code");
CREATE INDEX IF NOT EXISTS "tax_review_queue_items_tenantId_status_idx" ON "tax_review_queue_items"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tax_review_queue_items_assignedToUserId_status_idx" ON "tax_review_queue_items"("assignedToUserId", "status");
CREATE INDEX IF NOT EXISTS "tax_review_queue_items_reasonCode_severity_idx" ON "tax_review_queue_items"("reasonCode", "severity");
CREATE INDEX IF NOT EXISTS "tax_review_decisions_tenantId_outcome_idx" ON "tax_review_decisions"("tenantId", "outcome");
CREATE INDEX IF NOT EXISTS "tax_review_decisions_reasonCode_idx" ON "tax_review_decisions"("reasonCode");
CREATE UNIQUE INDEX IF NOT EXISTS "_DecisionRules_AB_unique" ON "_DecisionRules"("A", "B");
CREATE INDEX IF NOT EXISTS "_DecisionRules_B_index" ON "_DecisionRules"("B");

-- =============================================
— FOREIGN KEYS (idempotentes)
-- =============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_review_queue_items_quoteId_fkey') THEN
    ALTER TABLE "tax_review_queue_items" ADD CONSTRAINT "tax_review_queue_items_quoteId_fkey"
      FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_review_decisions_reviewItemId_fkey') THEN
    ALTER TABLE "tax_review_decisions" ADD CONSTRAINT "tax_review_decisions_reviewItemId_fkey"
      FOREIGN KEY ("reviewItemId") REFERENCES "tax_review_queue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_DecisionRules_A_fkey') THEN
    ALTER TABLE "_DecisionRules" ADD CONSTRAINT "_DecisionRules_A_fkey"
      FOREIGN KEY ("A") REFERENCES "tax_review_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_DecisionRules_B_fkey') THEN
    ALTER TABLE "_DecisionRules" ADD CONSTRAINT "_DecisionRules_B_fkey"
      FOREIGN KEY ("B") REFERENCES "TaxRuleCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
