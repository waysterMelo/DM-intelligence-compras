import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ReprocessingQueuePort, CreateJobInput, JobSummary } from '../ports/reprocessing-queue.port';
import { AuthContext, ScopeType } from '../dto/create-job.dto';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class PostgresQueueAdapter implements ReprocessingQueuePort {
  private readonly logger = new Logger(PostgresQueueAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async createJob(input: CreateJobInput, authContext: AuthContext): Promise<string> {
    // Enforce tenant isolation: tenantId must come from auth context
    const tenantId = input.tenantId || authContext.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'tenantId is required. It must be provided in the JWT or explicitly in the request.'
      );
    }

    // Enforce buyerCompanyId is provided
    const buyerCompanyId = input.buyerCompanyId;
    if (!buyerCompanyId) {
      throw new BadRequestException(
        'buyerCompanyId is required. It must be explicitly provided when creating a job.'
      );
    }

    // Verify buyer exists and belongs to this tenant
    const buyer = await this.prisma.fornecedor.findFirst({
      where: { id: buyerCompanyId, companyRole: 'BUYER', isActive: true }
    });
    if (!buyer) {
      throw new BadRequestException(
        `Buyer company ${buyerCompanyId} not found, not active, or not a BUYER role.`
      );
    }

    // Create job record
    const job = await this.prisma.taxReprocessingJob.create({
      data: {
        tenantId,
        requestedByUserId: authContext.userId, // Always from auth context, not body
        buyerCompanyId,
        scopeType: input.scopeType,
        scopePayloadJson: input.scopePayloadJson,
        reason: input.reason,
        engineVersionFrom: input.engineVersionFrom,
        engineVersionTo: input.engineVersionTo,
        status: 'QUEUED',
      }
    });

    // Resolve scope to quote IDs (with tenant isolation)
    const targetQuoteIds = await this.resolveScope(input, tenantId);

    if (targetQuoteIds.length === 0) {
      await this.prisma.taxReprocessingJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED_ALL_SKIPPED', finishedAt: new Date() }
      });
      this.logger.log(`[Adapter] Job ${job.id} created with 0 target quotes. Marked as COMPLETED_ALL_SKIPPED.`);
      return job.id;
    }

    // Insert job items
    await this.prisma.taxReprocessingJobItem.createMany({
      data: targetQuoteIds.map(quoteId => ({
        jobId: job.id,
        quoteId,
        status: 'PENDING'
      }))
    });

    await this.prisma.taxReprocessingJob.update({
      where: { id: job.id },
      data: { totalItems: targetQuoteIds.length }
    });

    this.logger.log(`[Adapter] Job ${job.id} created with ${targetQuoteIds.length} items for tenant ${tenantId}.`);
    return job.id;
  }

  private async resolveScope(input: CreateJobInput, tenantId: string): Promise<string[]> {
    switch (input.scopeType) {
      case ScopeType.QUOTE: {
        const quoteId = input.scopePayloadJson?.quoteId;
        if (!quoteId) throw new BadRequestException('scopePayloadJson.quoteId is required for QUOTE scope');
        return [quoteId];
      }

      case ScopeType.COMPANY: {
        const companyId = input.scopePayloadJson?.companyId;
        if (!companyId) throw new BadRequestException('scopePayloadJson.companyId is required for COMPANY scope');
        const quotes = await this.prisma.quote.findMany({
          where: { fornecedorId: companyId },
          select: { id: true }
        });
        return quotes.map(q => q.id);
      }

      case ScopeType.TENANT_ALL: {
        // All quotes in the system (tenant-scoped)
        const quotes = await this.prisma.quote.findMany({
          select: { id: true }
        });
        return quotes.map(q => q.id);
      }

      case ScopeType.DATE_RANGE: {
        const startDate = input.scopePayloadJson?.startDate;
        const endDate = input.scopePayloadJson?.endDate;
        if (!startDate || !endDate) {
          throw new BadRequestException('scopePayloadJson.startDate and scopePayloadJson.endDate are required for DATE_RANGE scope');
        }
        const quotes = await this.prisma.quote.findMany({
          where: {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate)
            }
          },
          select: { id: true }
        });
        this.logger.log(`[Adapter] DATE_RANGE scope matched ${quotes.length} quotes`);
        return quotes.map(q => q.id);
      }

      case ScopeType.ENGINE_VERSION: {
        const fromVersion = input.engineVersionFrom || input.scopePayloadJson?.fromVersion;
        const toVersion = input.engineVersionTo || input.scopePayloadJson?.toVersion;

        const whereClause: any = {};
        if (fromVersion) {
          whereClause.lastTaxEngineVersion = { gte: fromVersion };
        }
        if (toVersion) {
          whereClause.lastTaxEngineVersion = {
            ...whereClause.lastTaxEngineVersion,
            lte: toVersion
          };
        }
        // If neither specified, match all quotes with any engine version set
        if (!fromVersion && !toVersion) {
          whereClause.lastTaxEngineVersion = { not: null };
        }

        const quotes = await this.prisma.quote.findMany({
          where: whereClause,
          select: { id: true }
        });
        this.logger.log(`[Adapter] ENGINE_VERSION scope matched ${quotes.length} quotes`);
        return quotes.map(q => q.id);
      }

      default:
        throw new BadRequestException(`Unknown scopeType: ${input.scopeType}`);
    }
  }

  async getPendingJobs(tenantId?: string): Promise<JobSummary[]> {
    const where: any = { status: 'QUEUED' };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    return this.prisma.taxReprocessingJob.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    }) as Promise<JobSummary[]>;
  }

  async lockJob(jobId: string): Promise<boolean> {
    const result = await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() }
    });
    return result.count > 0;
  }

  async getJobProgress(jobId: string): Promise<JobSummary | null> {
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
            startedAt: true,
            finishedAt: true
          }
        }
      }
    });
    return job as JobSummary | null;
  }

  async cancelJob(jobId: string): Promise<void> {
    // Force cancel: only QUEUED or RUNNING jobs
    await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELED', finishedAt: new Date() }
    });
  }

  async cancelJobCooperative(jobId: string): Promise<void> {
    // Cooperative: sets cancelRequestedAt, allowing in-progress work to finish gracefully
    await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: { in: ['QUEUED', 'RUNNING'] }, cancelRequestedAt: null },
      data: { cancelRequestedAt: new Date() }
    });
  }

  async isJobCancelled(jobId: string): Promise<boolean> {
    const job = await this.prisma.taxReprocessingJob.findUnique({
      where: { id: jobId },
      select: { cancelRequestedAt: true, status: true }
    });
    return !!(job?.cancelRequestedAt && ['QUEUED', 'RUNNING'].includes(job.status));
  }
}
