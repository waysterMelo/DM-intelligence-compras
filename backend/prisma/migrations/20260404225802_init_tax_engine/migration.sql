-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "cest" TEXT,
ADD COLUMN     "cfop" TEXT,
ADD COLUMN     "creditNature" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "cstIpi" TEXT,
ADD COLUMN     "isExempt" BOOLEAN DEFAULT false,
ADD COLUMN     "isMonophase" BOOLEAN DEFAULT false,
ADD COLUMN     "isSuspended" BOOLEAN DEFAULT false,
ADD COLUMN     "isZeroRate" BOOLEAN DEFAULT false,
ADD COLUMN     "ncm" TEXT,
ADD COLUMN     "operationType" TEXT NOT NULL DEFAULT 'INTERNAL';

-- AlterTable
ALTER TABLE "fornecedores" ADD COLUMN     "isIcmsTaxpayer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isIpiTaxpayer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pisCofinsRegime" TEXT NOT NULL DEFAULT 'CUMULATIVE',
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'SP';

-- CreateTable
CREATE TABLE "quote_tax_snapshots" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grossCostUnit" DOUBLE PRECISION NOT NULL,
    "grossCostTotal" DOUBLE PRECISION NOT NULL,
    "netCostUnit" DOUBLE PRECISION NOT NULL,
    "netCostTotal" DOUBLE PRECISION NOT NULL,
    "icmsCredit" DOUBLE PRECISION NOT NULL,
    "pisCredit" DOUBLE PRECISION NOT NULL,
    "cofinsCredit" DOUBLE PRECISION NOT NULL,
    "ipiCredit" DOUBLE PRECISION NOT NULL,
    "legalBasisJson" JSONB NOT NULL,
    "disallowedCreditsJson" JSONB NOT NULL,
    "memoryJson" JSONB NOT NULL,

    CONSTRAINT "quote_tax_snapshots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quote_tax_snapshots" ADD CONSTRAINT "quote_tax_snapshots_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
