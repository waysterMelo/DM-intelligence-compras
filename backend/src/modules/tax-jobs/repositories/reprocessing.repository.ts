import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { SemverUtil } from '../utils/semver.util';

// === DTOs de Interface ===

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

export interface JobRecord {
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

export type JobStatusFilter = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_ALL_SKIPPED' | 'PARTIAL' | 'FAILED' | 'CANCELED';

// Parâmetros para resolução de escopo (concentrada no repositório)
export interface ScopeResolutionInput {
  scopeType: string;
  scopePayloadJson: Record<string, any>;
  engineVersionFrom?: string;
  engineVersionTo?: string;
}

/**
 * Repositório centralizado para todas as operações de reprocessamento.
 *
 * Responsabilidades:
 * - Ciclo de vida do job (criar, buscar, travar, concluir)
 * - Ciclo de vida do item (iniciar, marcar, retry)
 * - Resolução de escopo → quote IDs (única fonte de verdade)
 * - Queries de cotação tenant-scoped
 * - Sumário operacional para dashboard
 */
@Injectable()
export class ReprocessingRepository {
  constructor(private readonly prisma: PrismaService) {}

  // === Job Lifecycle ===

  async findNextQueuedJob(): Promise<JobRecord | null> {
    return this.prisma.taxReprocessingJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' }
    }) as Promise<JobRecord | null>;
  }

  async lockJob(jobId: string): Promise<number> {
    const result = await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() }
    });
    return result.count;
  }

  async getJobStatus(jobId: string): Promise<JobRecord | null> {
    return this.prisma.taxReprocessingJob.findUnique({
      where: { id: jobId }
    }) as Promise<JobRecord | null>;
  }

  async getJobByTenant(jobId: string, tenantId: string): Promise<JobRecord | null> {
    return this.prisma.taxReprocessingJob.findFirst({
      where: { id: jobId, tenantId }
    }) as Promise<JobRecord | null>;
  }

  async getJobsByStatus(statuses: JobStatusFilter[], tenantId?: string): Promise<JobRecord[]> {
    const where: any = {};
    if (statuses.length > 0) {
      where.status = { in: statuses };
    }
    if (tenantId) {
      where.tenantId = tenantId;
    }
    return this.prisma.taxReprocessingJob.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    }) as Promise<JobRecord[]>;
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

  async createJobRecord(data: {
    tenantId: string;
    requestedByUserId: string;
    buyerCompanyId: string;
    scopeType: string;
    scopePayloadJson: any;
    reason: string;
    engineVersionFrom?: string;
    engineVersionTo?: string;
  }): Promise<string> {
    const job = await this.prisma.taxReprocessingJob.create({
      data: { ...data, status: 'QUEUED' }
    });
    return job.id;
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

  async requestCancelCooperative(jobId: string): Promise<void> {
    await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: { in: ['QUEUED', 'RUNNING'] }, cancelRequestedAt: null },
      data: { cancelRequestedAt: new Date() }
    });
  }

  async createJobItems(jobId: string, quoteIds: string[]): Promise<void> {
    if (quoteIds.length === 0) return;
    await this.prisma.taxReprocessingJobItem.createMany({
      data: quoteIds.map(quoteId => ({ jobId, quoteId, status: 'PENDING' }))
    });
    await this.prisma.taxReprocessingJob.update({
      where: { id: jobId },
      data: { totalItems: quoteIds.length }
    });
  }

  // === Escopo → Quote IDs (única fonte de verdade) ===

  /**
   * Resolve um escopo em uma lista de quote IDs com isolamento total por tenant.
   * Centralizado aqui para eliminar duplicação entre adapter e repositório.
   */
  async resolveScope(input: ScopeResolutionInput, tenantId: string, buyerCompanyId: string): Promise<string[]> {
    switch (input.scopeType) {
      case 'QUOTE': {
        const quoteId = input.scopePayloadJson?.quoteId;
        if (!quoteId) return [];
        // Validar que a quote pertence ao tenant
        const quote = await this.prisma.quote.findFirst({
          where: { id: quoteId, fornecedor: { tenantId } },
          select: { id: true }
        });
        return quote ? [quoteId] : [];
      }

      case 'COMPANY': {
        const companyId = input.scopePayloadJson?.companyId;
        if (!companyId) return [];
        // Validar que a empresa pertence ao tenant
        const company = await this.prisma.fornecedor.findFirst({
          where: { id: companyId, tenantId }
        });
        if (!company) return [];
        const quotes = await this.prisma.quote.findMany({
          where: { fornecedorId: companyId, fornecedor: { tenantId } },
          select: { id: true }
        });
        return quotes.map(q => q.id);
      }

      case 'TENANT_ALL': {
        const quotes = await this.prisma.quote.findMany({
          where: { fornecedor: { tenantId } },
          select: { id: true }
        });
        return quotes.map(q => q.id);
      }

      case 'DATE_RANGE': {
        const startDate = input.scopePayloadJson?.startDate;
        const endDate = input.scopePayloadJson?.endDate;
        if (!startDate || !endDate) return [];
        const quotes = await this.prisma.quote.findMany({
          where: {
            fornecedor: { tenantId },
            createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
          },
          select: { id: true }
        });
        return quotes.map(q => q.id);
      }

      case 'ENGINE_VERSION': {
        const fromVersion = input.engineVersionFrom || input.scopePayloadJson?.fromVersion;
        const toVersion = input.engineVersionTo || input.scopePayloadJson?.toVersion;

        // Retorna todas as quotes com engine version do tenant
        const quotes = await this.prisma.quote.findMany({
          where: {
            fornecedor: { tenantId },
            lastTaxEngineVersion: { not: null }
          },
          select: { id: true, lastTaxEngineVersion: true }
        });

        // Filtro semântico via SemverUtil (única fonte de verdade)
        return quotes
          .filter(q => {
            const ver = q.lastTaxEngineVersion;
            if (!ver) return false;
            return SemverUtil.inRange(ver, fromVersion, toVersion);
          })
          .map(q => q.id);
      }

      default:
        return [];
    }
  }

  // === Validação de Buyer ===

  async validateBuyer(buyerCompanyId: string, tenantId: string): Promise<boolean> {
    const buyer = await this.prisma.fornecedor.findFirst({
      where: { id: buyerCompanyId, companyRole: 'BUYER', isActive: true, tenantId }
    });
    return !!buyer;
  }

  // === Quote Queries (todas tenant-scoped) ===

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

  // === Dashboard Operacional ===

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
}
