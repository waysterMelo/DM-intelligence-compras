-- Fiscal configuration introduced after the initial schema.
CREATE TABLE "tax_configurations" (
    "id" TEXT NOT NULL,
    "icmsCreditPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "pisCreditPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "cofinsCreditPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "ipiCreditPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "fornecedorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tax_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_configurations_fornecedorId_key" ON "tax_configurations"("fornecedorId");
ALTER TABLE "tax_configurations" ADD CONSTRAINT "tax_configurations_fornecedorId_fkey"
  FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Quick-purchase lifecycle: commercial booking first, fiscal entry after the NF.
ALTER TABLE "Requisition"
  ADD COLUMN "purchaseMode" TEXT NOT NULL DEFAULT 'STRATEGIC',
  ADD COLUMN "taxStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceAccessKey" TEXT,
  ADD COLUMN "invoiceIssueDate" TIMESTAMP(3),
  ADD COLUMN "taxReviewedAt" TIMESTAMP(3);

-- Item-level utilization and 2026 IBS/CBS document fields.
ALTER TABLE "Quote"
  ADD COLUMN "utilizationIcms" DOUBLE PRECISION DEFAULT 100.0,
  ADD COLUMN "utilizationPis" DOUBLE PRECISION DEFAULT 100.0,
  ADD COLUMN "utilizationCofins" DOUBLE PRECISION DEFAULT 100.0,
  ADD COLUMN "utilizationIpi" DOUBLE PRECISION DEFAULT 100.0,
  ADD COLUMN "cstIbsCbs" TEXT,
  ADD COLUMN "taxClassCode" TEXT,
  ADD COLUMN "cbsRate" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "cbsValue" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "ibsRate" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "ibsValue" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "creditIpi" DOUBLE PRECISION DEFAULT 0;

CREATE INDEX "Requisition_purchaseMode_taxStatus_idx" ON "Requisition"("purchaseMode", "taxStatus");
