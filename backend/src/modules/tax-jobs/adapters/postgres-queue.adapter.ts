import { Injectable, Logger } from '@nestjs/common';
import { ReprocessingQueuePort, CreateJobInput } from '../ports/reprocessing-queue.port';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class PostgresQueueAdapter implements ReprocessingQueuePort {
  private readonly logger = new Logger(PostgresQueueAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async createJob(input: CreateJobInput): Promise<string> {
    const job = await this.prisma.taxReprocessingJob.create({
      data: {
        tenantId: input.tenantId,
        requestedByUserId: input.requestedByUserId,
        scopeType: input.scopeType,
        scopePayloadJson: input.scopePayloadJson,
        reason: input.reason,
        engineVersionFrom: input.engineVersionFrom,
        engineVersionTo: input.engineVersionTo,
        status: 'QUEUED',
      }
    });

    // Resolve as Quotes based on the scope
    let targetQuoteIds: string[] = [];

    if (input.scopeType === 'QUOTE') {
      targetQuoteIds.push(input.scopePayloadJson.quoteId);
    } else if (input.scopeType === 'COMPANY') {
      const quotes = await this.prisma.quote.findMany({
        where: { fornecedorId: input.scopePayloadJson.companyId },
        select: { id: true }
      });
      targetQuoteIds = quotes.map(q => q.id);
    } else if (input.scopeType === 'TENANT_ALL') {
      const quotes = await this.prisma.quote.findMany({ select: { id: true } });
      targetQuoteIds = quotes.map(q => q.id);
    }
    // Implement DATE_RANGE or ENGINE_VERSION later based on params

    if (targetQuoteIds.length === 0) {
      await this.prisma.taxReprocessingJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', finishedAt: new Date() }
      });
      return job.id;
    }

    // Insert Items
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

    return job.id;
  }

  async getPendingJobs(): Promise<any[]> {
    return this.prisma.taxReprocessingJob.findMany({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' }
    });
  }

  async lockJob(jobId: string): Promise<boolean> {
    // Basic locking by updating status atomically
    const result = await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date() }
    });
    return result.count > 0;
  }

  async getJobProgress(jobId: string): Promise<any> {
    return this.prisma.taxReprocessingJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          select: { id: true, status: true, skipReason: true, startedAt: true, finishedAt: true }
        }
      }
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.prisma.taxReprocessingJob.updateMany({
      where: { id: jobId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'CANCELED', finishedAt: new Date() }
    });
  }
}
