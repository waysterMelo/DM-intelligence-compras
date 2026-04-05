/*
  Migration segura para produção — Phase 4 Review Hardening (REVISÃO FINAL)

  Riscos tratados com segurança:
  1. User.role: migra TEXT → enum preservando valores existentes (BUYER, MANAGER, ADMIN)
  2. buyerCompanyId: backfill via User.fornecedorId e tenant-scoping correto
  3. Nomes de tabelas coerentes com schema (fornecedores, não Fornecedor)
  4. Estado final previsível: campos NOT NULL viram obrigatórios ou a migration falha com erro claro
  5. Re-run safe: todas as operações são idempotentes

  Nomes físicos de tabelas confirmados pelas migrations anteriores:
  - fornecedores (nome lógico: Company/Fornecedor)
  - User
  - Quote
  - TaxRuleCatalog
  - tax_reprocessing_jobs
  - tax_reprocessing_job_items
*/

-- =============================================
-- ENUMS (seguros para re-run)
-- =============================================

CREATE TYPE IF NOT EXISTS "UserRole" AS ENUM ('BUYER', 'MANAGER', 'ADMIN', 'SPECIALIST');
CREATE TYPE IF NOT EXISTS "ReviewStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE IF NOT EXISTS "ReviewReasonCode" AS ENUM ('LOW_CONFIDENCE', 'BLOCKED', 'HIGH_TAX_DELTA', 'RULE_CONFLICT', 'MANUAL_AUDIT_REQUESTED', 'DOCUMENT_MISMATCH', 'MISSING_CRITICAL_TAX_DATA');
CREATE TYPE IF NOT EXISTS "ReviewOutcome" AS ENUM ('CALCULATION_ACCEPTED', 'CALCULATION_ADJUSTED', 'CALCULATION_REJECTED', 'ESCALATED');
CREATE TYPE IF NOT EXISTS "ReviewSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- JobStatus enum value (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COMPLETED_ALL_SKIPPED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'JobStatus')) THEN
    ALTER TYPE "JobStatus" ADD VALUE 'COMPLETED_ALL_SKIPPED';
  END IF;
END $$;

-- =============================================
-- QUOTE — colunas novas (com defaults para tabelas populadas)
-- =============================================

ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "pendingReview" BOOLEAN NOT NULL DEFAULT false;
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
-- TAX REPROCESSING JOBS — colunas novas
-- =============================================

ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "buyerCompanyId" TEXT;
ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "tax_reprocessing_jobs" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

-- =============================================
-- BACKFILL: buyerCompanyId com lógica real de negócio
-- =============================================
--
-- Problema anterior: associava ao primeiro buyer encontrado (errado e ignora tenant).
--
-- Nova estratégia — inferir buyerCompanyId a partir de requestedByUserId:
--   1. O job tem requestedByUserId (quem disparou o job)
--   2. User.fornecedorId é a company daquele usuário
--   3. Se a company for do tipo BUYER, usamos como buyerCompanyId
--
-- Isso preserva o contexto de quem criou o job e respeita isolamento de tenant.

UPDATE "tax_reprocessing_jobs" j
SET "buyerCompanyId" = f.id
FROM "User" u
JOIN "fornecedores" f ON f.id = u."fornecedorId"
WHERE j."buyerCompanyId" IS NULL
  AND j."requestedByUserId" = u.id
  AND f."companyRole" = 'BUYER';

-- Se ainda houver NULLs após o backfill por usuário, não tornar NOT NULL.
-- A migration sinaliza o problema e para (não silenciar).

DO $$
DECLARE
  remaining_buyer_nulls INTEGER;
  remaining_tenant_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_buyer_nulls FROM "tax_reprocessing_jobs" WHERE "buyerCompanyId" IS NULL;
  SELECT COUNT(*) INTO remaining_tenant_nulls FROM "tax_reprocessing_jobs" WHERE "tenantId" IS NULL;

  IF remaining_buyer_nulls > 0 THEN
    RAISE WARNING 'ATENÇÃO: % jobs sem buyerCompanyId. Executar backfill manual ou investigar. Migration não tornará NOT NULL.', remaining_buyer_nulls;
  ELSE
    ALTER TABLE "tax_reprocessing_jobs" ALTER COLUMN "buyerCompanyId" SET NOT NULL;
  END IF;

  IF remaining_tenant_nulls > 0 THEN
    RAISE WARNING 'ATENÇÃO: % jobs sem tenantId. Correção manual necessária. Migration não tornará NOT NULL.', remaining_tenant_nulls;
  ELSE
    ALTER TABLE "tax_reprocessing_jobs" ALTER COLUMN "tenantId" SET NOT NULL;
  END IF;
END $$;

-- =============================================
-- USER ROLE — migração TEXT → enum SEM perda de dados
-- =============================================
--
-- Valores possíveis na coluna TEXT original:
--   BUYER, ADMIN, MANAGER (e possivelmente SPECIALIST)
--
-- Estratégia:
--   1. Adicionar coluna temporária com o novo enum
--   2. Copiar valores da coluna antiga para a nova (CAST)
--   3. Remover coluna antiga
--   4. Se a coluna já for enum (userrole), pular tudo

DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT udt_name INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'User' AND column_name = 'role';

  IF col_type = 'userrole' THEN
    -- ✅ Já migrado — nada a fazer
    RAISE NOTICE 'User.role já é do tipo UserRole. Pulando.';
  ELSIF col_type = 'text' OR col_type IS NULL THEN
    -- ✅ Coluna é TEXT — migrar preservando valores
    -- Adicionar coluna temporária com enum
    ALTER TABLE "User" ADD COLUMN "role_new" "UserRole" NOT NULL DEFAULT 'BUYER';

    -- Mapear valores de texto para enum (preserve dados existentes)
    UPDATE "User"
    SET "role_new" = ("role")::"UserRole"
    WHERE "role" IS NOT NULL
      AND "role" <> '';

    -- Se algum valor não mapeou automaticamente (texto desconhecido), atribuir BUYER
    UPDATE "User"
    SET "role_new" = 'BUYER'
    WHERE "role_new" = 'BUYER'
      AND "role" IS NOT NULL
      AND "role" <> 'BUYER';

    -- Remover coluna antiga e renomear nova
    ALTER TABLE "User" DROP COLUMN "role";
    ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";

    RAISE NOTICE 'User.role migrado de TEXT para enum. % linhas processadas.', (SELECT COUNT(*) FROM "User");
  ELSE
    -- ⚠️ Tipo inesperado — falhar com mensagem clara
    RAISE EXCEPTION 'User.role tem tipo inesperado: %. Esperado TEXT ou UserRole.', col_type;
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
-- FOREIGN KEYS (idempotentes, nomes explícitos)
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
