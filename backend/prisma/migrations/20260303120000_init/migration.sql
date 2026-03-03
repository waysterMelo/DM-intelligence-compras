-- CreateEnum
CREATE TYPE "ItemUseType" AS ENUM ('INDUSTRIAL_INPUT', 'CONSUMPTION', 'RESALE', 'FIXED_ASSET');

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "taxRegime" TEXT NOT NULL,
    "companyRole" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "finalCost" DOUBLE PRECISION,
    "paymentTerms" TEXT,
    "itemUseType" "ItemUseType" NOT NULL DEFAULT 'CONSUMPTION',
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "freight" DOUBLE PRECISION DEFAULT 0,
    "leadTime" INTEGER DEFAULT 0,
    "paymentTerms" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "itemUseType" "ItemUseType" NOT NULL DEFAULT 'CONSUMPTION',
    "cstIcms" TEXT,
    "csosn" TEXT,
    "hasIcmsSt" BOOLEAN NOT NULL DEFAULT false,
    "icmsRate" DOUBLE PRECISION DEFAULT 0,
    "icmsValue" DOUBLE PRECISION DEFAULT 0,
    "cstPis" TEXT,
    "cstCofins" TEXT,
    "pisRate" DOUBLE PRECISION DEFAULT 0,
    "cofinsRate" DOUBLE PRECISION DEFAULT 0,
    "pisValue" DOUBLE PRECISION DEFAULT 0,
    "cofinsValue" DOUBLE PRECISION DEFAULT 0,
    "ipiRate" DOUBLE PRECISION DEFAULT 0,
    "ipiValue" DOUBLE PRECISION DEFAULT 0,
    "creditIcms" DOUBLE PRECISION DEFAULT 0,
    "creditPis" DOUBLE PRECISION DEFAULT 0,
    "creditCofins" DOUBLE PRECISION DEFAULT 0,
    "netCost" DOUBLE PRECISION DEFAULT 0,
    "creditSource" TEXT DEFAULT 'MANUAL',
    "taxMemory" JSONB,
    "fornecedorId" TEXT,
    "requisitionId" TEXT NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_cnpj_key" ON "fornecedores"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
