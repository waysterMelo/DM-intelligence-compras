import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ReprocessingQueuePort, CreateJobInput, JobSummary } from '../ports/reprocessing-queue.port';
import { AuthContext } from '../dto/create-job.dto';
import { ReprocessingRepository } from '../repositories/reprocessing.repository';

/**
 * Adapter da fila em PostgreSQL.
 *
 * Responsabilidades:
 * - Implementar o contrato do ReprocessingQueuePort
 * - Delegar resolução de escopo e validações ao ReprocessingRepository
 * - Não fazer queries diretas de escopo (evitar duplicação)
 */
@Injectable()
export class PostgresQueueAdapter implements ReprocessingQueuePort {
  private readonly logger = new Logger(PostgresQueueAdapter.name);

  constructor(private readonly repo: ReprocessingRepository) {}

  async createJob(input: CreateJobInput, authContext: AuthContext): Promise<string> {
    // Tenant obrigatório
    const tenantId = input.tenantId || authContext.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'tenantId is required. It must be provided in the JWT or explicitly in the request.'
      );
    }

    // Buyer obrigatório
    const buyerCompanyId = input.buyerCompanyId;
    if (!buyerCompanyId) {
      throw new BadRequestException(
        'buyerCompanyId is required. It must be explicitly provided when creating a job.'
      );
    }

    // Validar buyer pertence ao tenant
    const buyerOk = await this.repo.validateBuyer(buyerCompanyId, tenantId);
    if (!buyerOk) {
      throw new BadRequestException(
        `Buyer company ${buyerCompanyId} not found, not active, or does not belong to tenant ${tenantId}.`
      );
    }

    // Criar job
    const jobId = await this.repo.createJobRecord({
      tenantId,
      requestedByUserId: authContext.userId,
      buyerCompanyId,
      scopeType: input.scopeType,
      scopePayloadJson: input.scopePayloadJson,
      reason: input.reason,
      engineVersionFrom: input.engineVersionFrom,
      engineVersionTo: input.engineVersionTo
    });

    // Resolver escopo via repositório (única fonte de verdade)
    const targetQuoteIds = await this.repo.resolveScope(
      {
        scopeType: input.scopeType,
        scopePayloadJson: input.scopePayloadJson,
        engineVersionFrom: input.engineVersionFrom,
        engineVersionTo: input.engineVersionTo
      },
      tenantId,
      buyerCompanyId
    );

    if (targetQuoteIds.length === 0) {
      await this.repo.concludeJob(jobId, 'COMPLETED_ALL_SKIPPED');
      this.logger.log(
        `[Adapter] Job ${jobId} created with 0 target quotes for tenant ${tenantId}. ` +
        `Marked as COMPLETED_ALL_SKIPPED.`
      );
      return jobId;
    }

    // Criar itens
    await this.repo.createJobItems(jobId, targetQuoteIds);

    this.logger.log(
      `[Adapter] Job ${jobId} created with ${targetQuoteIds.length} items for tenant ${tenantId}.`
    );
    return jobId;
  }

  async getPendingJobs(tenantId?: string): Promise<JobSummary[]> {
    // Retorna jobs QUEUED e RUNNING para visão operacional mínima
    return this.repo.getJobsByStatus(['QUEUED', 'RUNNING'], tenantId) as Promise<JobSummary[]>;
  }

  async getAllJobs(tenantId?: string): Promise<JobSummary[]> {
    // Retorna todos os jobs para dashboard completo
    return this.repo.getJobsByStatus([], tenantId) as Promise<JobSummary[]>;
  }

  async lockJob(jobId: string): Promise<boolean> {
    const lockCount = await this.repo.lockJob(jobId);
    return lockCount > 0;
  }

  async getJobProgress(jobId: string): Promise<JobSummary | null> {
    return this.repo.getJobSummary(jobId);
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.repo.concludeJob(jobId, 'CANCELED');
  }

  async cancelJobCooperative(jobId: string): Promise<void> {
    await this.repo.requestCancelCooperative(jobId);
  }

  async isJobCancelled(jobId: string): Promise<boolean> {
    const job = await this.repo.getJobStatus(jobId);
    return !!(job?.cancelRequestedAt && ['QUEUED', 'RUNNING'].includes(job.status));
  }
}
