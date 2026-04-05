import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export interface JobItemRecord {
  id: string;
  jobId: string;
  quoteId: string;
  status: string;
  skipReason?: string;
  errorMessage?: string;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface PendingJobRecord {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  buyerCompanyId: string;
  scopeType: string;
  scopePayloadJson: any;
  reason: string;
  engineVersionFrom?: string;
  engineVersionTo?: string;
  status: string;
  totalItems: number;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  cancelRequestedAt?: Date;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface QuoteForProcessing {
  id: string;
  fornecedorId: string;
  price: number;
  freight: number | null;
  itemUseType: string;
  creditNature: string;
  operationType: string;
  ipiRate: number | null;
  icmsRate: number | null;
  pisRate: number | null;
  cofinsRate: number | null;
  hasIcmsSt: boolean;
  lastTaxSnapshotId: string | null;
  requisition: {
    quantity: number;
  };
}

export interface SnapshotHashRecord {
  inputHash: string;
}

@Injectable()
export class ReprocessingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNextQueuedJob(): Promise<PendingJobRecord | null> {
    return this.prisma.taxReprocessingJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' }
    }) as Promise<PendingJobRecord | null>;
  }

  async lockJob(jobId: string): Promise<number> {
    const result = await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() }
    });
    return result.count;
  }

  async getJobStatus(jobId: string): Promise<PendingJobRecord | null> {
    return this.prisma.taxReprocessingJob.findUnique({
      where: { id: jobId }
    }) as Promise<PendingJobRecord | null>;
  }

  async findPendingJobItems(jobId: string, batchSize: number): Promise<JobItemRecord[]> {
    return this.prisma.taxReprocessingJobItem.findMany({
      where: { jobId, status: 'PENDING' },
      take: batchSize
    }) as Promise<JobItemRecord[]>;
  }

  async findPendingJobItemsByJobId(jobId: string, batchSize: number): Promise<JobItemRecord[]> {
    return this.prisma.taxReprocessingJobItem.findMany({
      where: { jobId, status: 'PENDING' },
      take: batchSize
    }) as Promise<JobItemRecord[]>;
  }

  async startItem(itemId: string): Promise<void> {
    await this.prisma.taxReprocessingJobItem.update({
      where: { id: itemId },
      data: { startedAt: new Date() }
    });
  }

  async markItemSkipped(itemId: string, data: {
    skipReason: string;
    oldSnapshotId?: string | null;
    oldInputHash?: string | null;
    newInputHash: string;
  }): Promise<void> {
    await this.prisma.taxReprocessingJobItem.update({
      where: { id: itemId },
      data: {
        status: 'SKIPPED',
        skipReason: data.skipReason,
        oldSnapshotId: data.oldSnapshotId,
        oldInputHash: data.oldInputHash,
        newInputHash: data.newInputHash,
        finishedAt: new Date()
      }
    });
  }

  async markItemProcessed(itemId: string, data: {
    oldSnapshotId?: string | null;
    newSnapshotId: string;
    oldInputHash?: string | null;
    newInputHash: string;
  }): Promise<void> {
    await this.prisma.taxReprocessingJobItem.update({
      where: { id: itemId },
      data: {
        status: 'PROCESSED',
        oldSnapshotId: data.oldSnapshotId,
        newSnapshotId: data.newSnapshotId,
        oldInputHash: data.oldInputHash,
        newInputHash: data.newInputHash,
        finishedAt: new Date()
      }
    });
  }

  async markItemFailed(itemId: string, errorMessage: string): Promise<void> {
    await this.prisma.taxReprocessingJobItem.update({
      where: { id: itemId },
      data: {
        status: 'FAILED',
        errorMessage,
        finishedAt: new Date()
      }
    });
  }

  async incrementJobCounters(jobId: string, processed: number, skipped: number, failed: number): Promise<void> {
    await this.prisma.taxReprocessingJob.update({
      where: { id: jobId },
      data: {
        processedItems: { increment: processed },
        skippedItems: { increment: skipped },
        failedItems: { increment: failed }
      }
    });
  }

  async concludeJob(jobId: string, status: string): Promise<void> {
    await this.prisma.taxReprocessingJob.update({
      where: { id: jobId },
      data: { status, finishedAt: new Date() }
    });
  }

  async cancelJobCooperative(jobId: string): Promise<void> {
    await this.prisma.taxReprocessingJob.update({
      where: { id: jobId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { cancelRequestedAt: new Date() }
    });
  }

  async cancelJobForce(jobId: string): Promise<void> {
    await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELED', finishedAt: new Date() }
    });
  }

  async findQuoteForProcessing(quoteId: string): Promise<QuoteForProcessing | null> {
    return this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { requisition: true, fornecedor: true }
    }) as Promise<QuoteForProcessing | null>;
  }

  async getSnapshotHash(snapshotId: string): Promise<SnapshotHashRecord | null> {
    return this.prisma.quoteTaxSnapshot.findUnique({
      where: { id: snapshotId },
      select: { inputHash: true }
    }) as Promise<SnapshotHashRecord | null>;
  }

  async getQuotesByCompanyId(companyId: string): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({
      where: { fornecedorId: companyId },
      select: { id: true }
    });
  }

  async getQuotesByTenant(tenantId: string): Promise<{ id: string }[]> {
    // In current schema, tenant is resolved via buyer company
    // This method should be adapted when tenant filtering is fully implemented
    return this.prisma.quote.findMany({
      select: { id: true }
    });
  }

  async getQuotesByDateRange(start: Date, end: Date): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: { id: true }
    });
  }

  async getQuotesByEngineVersion(fromVersion: string, toVersion?: string): Promise<{ id: string }[]> {
    const where: any = {};
    if (fromVersion) {
      where.lastTaxEngineVersion = { gte: fromVersion };
    }
    if (toVersion) {
      where.lastTaxEngineVersion = { ...where.lastTaxEngineVersion, lte: toVersion };
    }
    return this.prisma.quote.findMany({
      where,
      select: { id: true }
    });
  }

  async getQuotesByTenantAndBuyerId(buyerCompanyId: string): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({
      where: { fornecedorId: { not: buyerCompanyId } }, // quotes from suppliers TO this buyer
      select: { id: true }
    });
  }

  async getAllQuotes(): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({ select: { id: true } });
  }
}
