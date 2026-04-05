/*
  Warnings:

  - Added the required column `inputHash` to the `quote_tax_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inputJson` to the `quote_tax_snapshots` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "quote_tax_snapshots" ADD COLUMN     "hashAlgorithm" TEXT NOT NULL DEFAULT 'SHA-256',
ADD COLUMN     "hashSchemaVersion" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN     "inputHash" TEXT NOT NULL,
ADD COLUMN     "inputJson" JSONB NOT NULL;
