-- Premissas comerciais de recuperacao para estimativa de TCO.
CREATE TABLE "tco_assumptions" (
  "id" TEXT NOT NULL,
  "itemUseType" "ItemUseType" NOT NULL,
  "icmsRecoveryPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ipiRecoveryPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pisRecoveryPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cofinsRecoveryPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fornecedorId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tco_assumptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tco_assumptions_fornecedorId_itemUseType_key"
  ON "tco_assumptions"("fornecedorId", "itemUseType");
ALTER TABLE "tco_assumptions" ADD CONSTRAINT "tco_assumptions_fornecedorId_fkey"
  FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migra a configuracao global existente para cada destinacao. Uso/consumo
-- comeca zerado; as demais destinacoes preservam os percentuais atuais.
INSERT INTO "tco_assumptions" (
  "id", "itemUseType", "icmsRecoveryPct", "ipiRecoveryPct",
  "pisRecoveryPct", "cofinsRecoveryPct", "fornecedorId", "updatedAt"
)
SELECT
  md5(f."id" || ':' || use_type::text), use_type,
  CASE WHEN use_type = 'CONSUMPTION'::"ItemUseType" THEN 0 ELSE COALESCE(tc."icmsCreditPercentage", 0) END,
  CASE WHEN use_type = 'CONSUMPTION'::"ItemUseType" THEN 0 ELSE COALESCE(tc."ipiCreditPercentage", 0) END,
  CASE WHEN use_type = 'CONSUMPTION'::"ItemUseType" THEN 0 ELSE COALESCE(tc."pisCreditPercentage", 0) END,
  CASE WHEN use_type = 'CONSUMPTION'::"ItemUseType" THEN 0 ELSE COALESCE(tc."cofinsCreditPercentage", 0) END,
  f."id", CURRENT_TIMESTAMP
FROM "fornecedores" f
LEFT JOIN "tax_configurations" tc ON tc."fornecedorId" = f."id"
CROSS JOIN unnest(enum_range(NULL::"ItemUseType")) AS u(use_type)
WHERE f."companyRole" = 'BUYER';

ALTER TABLE "Requisition"
  ADD COLUMN "costReconciliationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "costReconciledAt" TIMESTAMP(3);

UPDATE "Requisition"
SET "costReconciliationStatus" = CASE
  WHEN "taxStatus" = 'PENDING_INVOICE' THEN 'PENDING_INVOICE'
  WHEN "taxStatus" = 'CALCULATED' THEN 'PENDING_INVOICE'
  WHEN "status" IN ('Comprado', 'Entregue') THEN 'PENDING_INVOICE'
  ELSE 'NOT_REQUIRED'
END;

UPDATE "Requisition" SET "costReconciledAt" = "taxReviewedAt" WHERE "taxReviewedAt" IS NOT NULL;
DROP INDEX IF EXISTS "Requisition_purchaseMode_taxStatus_idx";
CREATE INDEX "Requisition_purchaseMode_costReconciliationStatus_idx"
  ON "Requisition"("purchaseMode", "costReconciliationStatus");

ALTER TABLE "Quote"
  ADD COLUMN "ncm" TEXT,
  ADD COLUMN "cest" TEXT,
  ADD COLUMN "cfop" TEXT,
  ADD COLUMN "stRate" DOUBLE PRECISION,
  ADD COLUMN "stValue" DOUBLE PRECISION,
  ADD COLUMN "fcpRate" DOUBLE PRECISION,
  ADD COLUMN "fcpValue" DOUBLE PRECISION,
  ADD COLUMN "difalRate" DOUBLE PRECISION,
  ADD COLUMN "difalValue" DOUBLE PRECISION,
  ADD COLUMN "hasFcp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasDifal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ipiTreatment" TEXT NOT NULL DEFAULT 'ADDITIONAL',
  ADD COLUMN "stTreatment" TEXT NOT NULL DEFAULT 'ADDITIONAL',
  ADD COLUMN "fcpTreatment" TEXT NOT NULL DEFAULT 'ADDITIONAL',
  ADD COLUMN "difalTreatment" TEXT NOT NULL DEFAULT 'ADDITIONAL',
  ADD COLUMN "grossTotalCost" DOUBLE PRECISION,
  ADD COLUMN "estimatedCreditTotal" DOUBLE PRECISION,
  ADD COLUMN "estimatedNetTotal" DOUBLE PRECISION,
  ADD COLUMN "dataCompleteness" TEXT NOT NULL DEFAULT 'INCOMPLETE',
  ADD COLUMN "calculationSource" TEXT NOT NULL DEFAULT 'SUPPLIER_QUOTE',
  ADD COLUMN "tcoMemory" JSONB;

ALTER TABLE "Quote"
  ALTER COLUMN "icmsRate" DROP DEFAULT,
  ALTER COLUMN "icmsValue" DROP DEFAULT,
  ALTER COLUMN "pisRate" DROP DEFAULT,
  ALTER COLUMN "pisValue" DROP DEFAULT,
  ALTER COLUMN "cofinsRate" DROP DEFAULT,
  ALTER COLUMN "cofinsValue" DROP DEFAULT,
  ALTER COLUMN "ipiRate" DROP DEFAULT,
  ALTER COLUMN "ipiValue" DROP DEFAULT;

ALTER TABLE "Quote"
  ALTER COLUMN "utilizationIcms" DROP DEFAULT,
  ALTER COLUMN "utilizationPis" DROP DEFAULT,
  ALTER COLUMN "utilizationCofins" DROP DEFAULT,
  ALTER COLUMN "utilizationIpi" DROP DEFAULT;

-- Valores zero antigos eram defaults tecnicos e nao confirmacao do fornecedor.
UPDATE "Quote" SET
  "icmsRate" = NULLIF("icmsRate", 0), "icmsValue" = NULLIF("icmsValue", 0),
  "pisRate" = NULLIF("pisRate", 0), "pisValue" = NULLIF("pisValue", 0),
  "cofinsRate" = NULLIF("cofinsRate", 0), "cofinsValue" = NULLIF("cofinsValue", 0),
  "ipiRate" = NULLIF("ipiRate", 0), "ipiValue" = NULLIF("ipiValue", 0);

-- O valor 100 era default técnico do modelo anterior; apenas ajustes diferentes
-- de 100 podem ser reconhecidos como premissa específica da cotação.
UPDATE "Quote" SET
  "utilizationIcms" = NULLIF("utilizationIcms", 100),
  "utilizationPis" = NULLIF("utilizationPis", 100),
  "utilizationCofins" = NULLIF("utilizationCofins", 100),
  "utilizationIpi" = NULLIF("utilizationIpi", 100);

CREATE TABLE "PurchaseInvoice" (
  "id" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "series" TEXT,
  "accessKey" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "supplierCnpj" TEXT NOT NULL,
  "importSource" TEXT NOT NULL,
  "productTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "freightTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "grossTotal" DOUBLE PRECISION NOT NULL,
  "icmsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ipiTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pisTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cofinsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fcpTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "difalTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cbsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ibsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimatedRecoverableTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actualNetEstimatedTotal" DOUBLE PRECISION NOT NULL,
  "quotedGrossTotal" DOUBLE PRECISION NOT NULL,
  "quotedNetEstimatedTotal" DOUBLE PRECISION NOT NULL,
  "quotedFreightTotal" DOUBLE PRECISION NOT NULL,
  "quotedTaxTotal" DOUBLE PRECISION NOT NULL,
  "actualTaxTotal" DOUBLE PRECISION NOT NULL,
  "freightVariance" DOUBLE PRECISION NOT NULL,
  "taxVariance" DOUBLE PRECISION NOT NULL,
  "grossVariance" DOUBLE PRECISION NOT NULL,
  "netVariance" DOUBLE PRECISION NOT NULL,
  "xmlContent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseInvoice_requisitionId_key" ON "PurchaseInvoice"("requisitionId");
CREATE UNIQUE INDEX "PurchaseInvoice_accessKey_key" ON "PurchaseInvoice"("accessKey");
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserva notas registradas pelo fluxo anterior, sem alterar a cotação original.
INSERT INTO "PurchaseInvoice" (
  "id", "requisitionId", "number", "series", "accessKey", "issueDate", "supplierCnpj", "importSource",
  "productTotal", "freightTotal", "discountTotal", "grossTotal",
  "icmsTotal", "ipiTotal", "pisTotal", "cofinsTotal", "stTotal", "fcpTotal", "difalTotal", "cbsTotal", "ibsTotal",
  "estimatedRecoverableTotal", "actualNetEstimatedTotal", "quotedGrossTotal", "quotedNetEstimatedTotal",
  "quotedFreightTotal", "quotedTaxTotal", "actualTaxTotal", "freightVariance", "taxVariance",
  "grossVariance", "netVariance", "xmlContent", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (r."invoiceAccessKey")
  md5('invoice:' || r."id"), r."id", r."invoiceNumber", NULL, r."invoiceAccessKey", r."invoiceIssueDate",
  regexp_replace(f."cnpj", '[^0-9]', '', 'g'), 'MANUAL',
  q."price" * r."quantity", COALESCE(q."freight", 0), 0,
  COALESCE(q."grossTotalCost", q."price" * r."quantity" + COALESCE(q."freight", 0), r."finalCost" * r."quantity"),
  COALESCE(q."icmsValue", q."price" * q."icmsRate" / 100, 0) * r."quantity",
  COALESCE(q."ipiValue", q."price" * q."ipiRate" / 100, 0) * r."quantity",
  COALESCE(q."pisValue", q."price" * q."pisRate" / 100, 0) * r."quantity",
  COALESCE(q."cofinsValue", q."price" * q."cofinsRate" / 100, 0) * r."quantity",
  0, 0, 0, COALESCE(q."cbsValue", 0) * r."quantity", COALESCE(q."ibsValue", 0) * r."quantity",
  (COALESCE(q."creditIcms", 0) + COALESCE(q."creditIpi", 0) + COALESCE(q."creditPis", 0) + COALESCE(q."creditCofins", 0)) * r."quantity",
  COALESCE(q."estimatedNetTotal", q."netCost" * r."quantity", q."price" * r."quantity" + COALESCE(q."freight", 0)),
  COALESCE(q."grossTotalCost", q."price" * r."quantity" + COALESCE(q."freight", 0)),
  COALESCE(q."estimatedNetTotal", q."netCost" * r."quantity", q."price" * r."quantity" + COALESCE(q."freight", 0)),
  COALESCE(q."freight", 0),
  (
    COALESCE(q."icmsValue", q."price" * q."icmsRate" / 100, 0) +
    COALESCE(q."ipiValue", q."price" * q."ipiRate" / 100, 0) +
    COALESCE(q."pisValue", q."price" * q."pisRate" / 100, 0) +
    COALESCE(q."cofinsValue", q."price" * q."cofinsRate" / 100, 0)
  ) * r."quantity",
  (
    COALESCE(q."icmsValue", q."price" * q."icmsRate" / 100, 0) +
    COALESCE(q."ipiValue", q."price" * q."ipiRate" / 100, 0) +
    COALESCE(q."pisValue", q."price" * q."pisRate" / 100, 0) +
    COALESCE(q."cofinsValue", q."price" * q."cofinsRate" / 100, 0)
  ) * r."quantity",
  0, 0, 0, 0, NULL, COALESCE(r."taxReviewedAt", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM "Requisition" r
JOIN LATERAL (
  SELECT candidate.* FROM "Quote" candidate
  WHERE candidate."requisitionId" = r."id" AND candidate."fornecedorId" IS NOT NULL
  ORDER BY candidate."isSelected" DESC, candidate."id"
  LIMIT 1
) q ON TRUE
JOIN "fornecedores" f ON f."id" = q."fornecedorId"
WHERE r."taxStatus" = 'CALCULATED'
  AND r."invoiceNumber" IS NOT NULL
  AND r."invoiceIssueDate" IS NOT NULL
  AND r."invoiceAccessKey" ~ '^\d{44}$'
ORDER BY r."invoiceAccessKey", r."taxReviewedAt" DESC NULLS LAST;

UPDATE "Requisition" r
SET "costReconciliationStatus" = 'COST_CONFIRMED'
WHERE EXISTS (SELECT 1 FROM "PurchaseInvoice" pi WHERE pi."requisitionId" = r."id");

ALTER TABLE "Requisition"
  DROP COLUMN "taxStatus",
  DROP COLUMN "invoiceNumber",
  DROP COLUMN "invoiceAccessKey",
  DROP COLUMN "invoiceIssueDate",
  DROP COLUMN "taxReviewedAt";
