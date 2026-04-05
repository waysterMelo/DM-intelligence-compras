import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export interface JobItemRecord {
  id: string;
  jobId: string;
  quoteId: string;
  status: string;
  skipReason?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
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

  // === Job Lifecycle ===

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

  async getJobByTenant(jobId: string, tenantId: string): Promise<PendingJobRecord | null> {
    return this.prisma.taxReprocessingJob.findFirst({
      where: { id: jobId, tenantId }
    }) as Promise<PendingJobRecord | null>;
  }

  async concludeJob(jobId: string, status: string): Promise<void> {
    await this.prisma.taxReprocessingJob.update({
      where: { id: jobId },
      data: { status: status as any, finishedAt: new Date() }
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

  // === Item Lifecycle ===

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

  async incrementItemRetry(itemId: string): Promise<{ retryCount: number; maxRetries: number } | null> {
    const updated = await this.prisma.taxReprocessingJobItem.update({
      where: { id: itemId },
      data: { retryCount: { increment: 1 } },
      select: { retryCount: true, maxRetries: true }
    });
    return updated;
  }

  async resetItemToPending(itemId: string, errorMessage?: string): Promise<void> {
    // Reset item back to PENDING for retry (keep error message for debugging)
    await this.prisma.taxReprocessingJobItem.update({
      where: { id: itemId },
      data: {
        status: 'PENDING',
        errorMessage: errorMessage || null,
        startedAt: null,
        finishedAt: null
      }
    });
  }

  async cancelRemainingItems(jobId: string): Promise<void> {
    await this.prisma.taxReprocessingJobItem.updateMany({
      where: { jobId, status: 'PENDING' },
      data: { status: 'SKIPPED', skipReason: 'JOB_CANCELLED', finishedAt: new Date() }
    });
  }

  async getJobSummary(jobId: string): Promise<any> {
    const job = await this.prisma.taxReprocessingJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          select: {
            id: true,
            quoteId: true,
            status: true,
            skipReason: true,
            errorMessage: true,
            retryCount: true,
            maxRetries: true,
            startedAt: true,
            finishedAt: true
          },
          orderBy: { finishedAt: 'desc' }
        }
      }
    });

    if (!job) return null;

    // Compute operational summary
    const totalItems = job.totalItems || 0;
    const processed = job.processedItems || 0;
    const skipped = job.skippedItems || 0;
    const failed = job.failedItems || 0;
    const completionRate = totalItems > 0 ? ((processed + skipped + failed) / totalItems) * 100 : 0;
    const skipRate = totalItems > 0 ? (skipped / totalItems) * 100 : 0;
    const failRate = totalItems > 0 ? (failed / totalItems) * 100 : 0;

    const itemsByStatus: Record<string, number> = {};
    for (const item of job.items) {
      itemsByStatus[item.status] = (itemsByStatus[item.status] || 0) + 1;
    }

    return {
      ...job,
      _summary: {
        completionRate: `${completionRate.toFixed(1)}%`,
        skipRate: `${skipRate.toFixed(1)}%`,
        failRate: `${failRate.toFixed(1)}%`,
        itemsByStatus,
        hasRetries: job.items.some((i: any) => i.retryCount > 0)
      }
    };
  }

  // === Quote Queries (all tenant-scoped) ===

  async findQuoteForProcessing(quoteId: string): Promise<QuoteForProcessing | null> {
    return this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { requisition: true, fornecedor: true }
    }) as Promise<QuoteForProcessing | null>;
  }

  async findQuoteForProcessingTenantScoped(quoteId: string, tenantId: string): Promise<QuoteForProcessing | null> {
    return this.prisma.quote.findFirst({
      where: { id: quoteId, fornecedor: { tenantId } },
      include: { requisition: true, fornecedor: true }
    }) as Promise<QuoteForProcessing | null>;
  }

  async getSnapshotHash(snapshotId: string): Promise<SnapshotHashRecord | null> {
    return this.prisma.quoteTaxSnapshot.findUnique({
      where: { id: snapshotId },
      select: { inputHash: true }
    }) as Promise<SnapshotHashRecord | null>;
  }

  async getQuotesByCompanyId(companyId: string, tenantId: string): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({
      where: { fornecedorId: companyId, fornecedor: { tenantId } },
      select: { id: true }
    });
  }

  async getQuotesByTenant(tenantId: string): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({
      where: { fornecedor: { tenantId } },
      select: { id: true }
    });
  }

  async getQuotesByDateRange(start: Date, end: Date, tenantId: string): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({
      where: {
        fornecedor: { tenantId },
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: { id: true }
    });
  }

  /**
   * Retorna quotes com engine version setada, tenant-scoped.
   * NÃO faz comparação por string no banco — retorna todas as versões
   * e o filtro semântico é feito pelo caller via SemverUtil.
   * Isso garante comportamento consistente e unificado em toda a aplicação.
   */
  async getQuotesWithEngineVersion(tenantId: string): Promise<{ id: string; lastTaxEngineVersion: string | null }[]> {
    return this.prisma.quote.findMany({
      where: {
        fornecedor: { tenantId },
        lastTaxEngineVersion: { not: null }
      },
      select: { id: true, lastTaxEngineVersion: true }
    });
  }

  async getAllQuotes(tenantId: string): Promise<{ id: string }[]> {
    return this.prisma.quote.findMany({
      where: { fornecedor: { tenantId } },
      select: { id: true }
    });
  }
}
