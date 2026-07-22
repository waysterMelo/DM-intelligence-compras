-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "JobItemStatus" AS ENUM ('PENDING', 'PROCESSED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "tax_reprocessing_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopePayloadJson" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "engineVersionFrom" TEXT,
    "engineVersionTo" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "skippedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "tax_reprocessing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_reprocessing_job_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "oldSnapshotId" TEXT,
    "newSnapshotId" TEXT,
    "oldInputHash" TEXT,
    "newInputHash" TEXT,
    "status" "JobItemStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "tax_reprocessing_job_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tax_reprocessing_job_items" ADD CONSTRAINT "tax_reprocessing_job_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "tax_reprocessing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
