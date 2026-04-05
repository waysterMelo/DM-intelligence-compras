import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  UseGuards,
  Request,
  Req,
  Query
} from '@nestjs/common';
import { ReprocessingQueuePort } from './ports/reprocessing-queue.port';
import { CreateJobDto } from './dto/create-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { ReprocessingRepository, JobStatusFilter } from './repositories/reprocessing.repository';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    username: string;
    role: string;
    tenantId?: string;
  };
}

@Controller('tax-governance/reprocess-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxJobsController {
  constructor(
    private readonly queue: ReprocessingQueuePort,
    private readonly repository: ReprocessingRepository
  ) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async createJob(@Body() dto: CreateJobDto, @Req() req: AuthenticatedRequest) {
    // tenantId comes from auth context (JWT) or explicit override
    const tenantId = dto.tenantId || req.user.tenantId;
    if (!tenantId) {
      throw new BadRequestException(
        'tenantId is required. It must be present in your JWT token or explicitly provided.'
      );
    }

    // buyerCompanyId must be explicitly provided for the job
    if (!dto.buyerCompanyId) {
      throw new BadRequestException(
        'buyerCompanyId is required. You must specify which buyer company this job is for.'
      );
    }

    const jobId = await this.queue.createJob(
      {
        tenantId,
        requestedByUserId: req.user.userId, // Always from authenticated context
        buyerCompanyId: dto.buyerCompanyId,
        scopeType: dto.scopeType,
        scopePayloadJson: dto.scopePayloadJson || {},
        reason: dto.reason,
        engineVersionFrom: dto.engineVersionFrom,
        engineVersionTo: dto.engineVersionTo
      },
      {
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        tenantId: req.user.tenantId
      }
    );

    return {
      success: true,
      jobId,
      message: 'Job scheduled successfully. It will be executed asynchronously.'
    };
  }

  @Get()
  async listJobs(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string | string[]
  ) {
    const tenantId = req.user.tenantId;

    // Se status não fornecido, retorna QUEUED + RUNNING (visão padrão)
    if (!status) {
      return this.queue.getPendingJobs(tenantId);
    }

    // Dashboard operacional completo: filtra por status
    const statusArray = Array.isArray(status) ? status : [status];
    const validStatuses = statusArray.filter((s): s is JobStatusFilter =>
      ['QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_ALL_SKIPPED', 'PARTIAL', 'FAILED', 'CANCELED'].includes(s)
    );

    if (validStatuses.length === 0) {
      throw new BadRequestException(
        `Invalid status filter. Valid values: QUEUED, RUNNING, COMPLETED, COMPLETED_ALL_SKIPPED, PARTIAL, FAILED, CANCELED`
      );
    }

    return this.repository.getJobsByStatus(validStatuses, tenantId || undefined);
  }

  @Get('dashboard')
  @Roles('ADMIN', 'MANAGER')
  async dashboard(@Req() req: AuthenticatedRequest) {
    // Visão completa de todos os status para dashboard operacional
    const tenantId = req.user.tenantId;
    const allJobs = await this.repository.getJobsByStatus([], tenantId || undefined);

    const byStatus: Record<string, number> = {};
    for (const job of allJobs) {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
    }

    const totalItems = allJobs.reduce((sum, j) => sum + j.totalItems, 0);
    const totalProcessed = allJobs.reduce((sum, j) => sum + j.processedItems, 0);
    const totalSkipped = allJobs.reduce((sum, j) => sum + j.skippedItems, 0);
    const totalFailed = allJobs.reduce((sum, j) => sum + j.failedItems, 0);

    return {
      byStatus,
      totals: {
        jobs: allJobs.length,
        items: totalItems,
        processed: totalProcessed,
        skipped: totalSkipped,
        failed: totalFailed
      },
      recentJobs: allJobs
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
    };
  }

  @Get(':id')
  async getJobInfo(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;

    // Validate job belongs to user's tenant
    const job = await this.repository.getJobByTenant(id, tenantId!);
    if (!job) {
      throw new NotFoundException(
        `Job ${id} not found or does not belong to your tenant.`
      );
    }

    // Return enriched progress
    return this.repository.getJobSummary(id);
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  async cancelJob(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;

    // Validate job belongs to user's tenant
    const job = await this.repository.getJobByTenant(id, tenantId!);
    if (!job) {
      throw new NotFoundException(
        `Job ${id} not found or does not belong to your tenant.`
      );
    }

    if (!['QUEUED', 'RUNNING'].includes(job.status)) {
      throw new BadRequestException(
        `Cannot cancel job in status: ${job.status}. Only QUEUED or RUNNING jobs can be cancelled.`
      );
    }

    // Cooperative cancellation: allows in-progress work to finish gracefully
    await this.queue.cancelJobCooperative(id);
    return {
      success: true,
      message: `Cancellation requested for job ${id}. In-progress work will finish gracefully.`
    };
  }

  @Post(':id/cancel-force')
  @Roles('ADMIN')
  async forceCancelJob(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;

    // Validate job belongs to user's tenant
    const job = await this.repository.getJobByTenant(id, tenantId!);
    if (!job) {
      throw new NotFoundException(
        `Job ${id} not found or does not belong to your tenant.`
      );
    }

    if (!['QUEUED', 'RUNNING'].includes(job.status)) {
      throw new BadRequestException(
        `Cannot force cancel job in status: ${job.status}. Only QUEUED or RUNNING jobs can be force cancelled.`
      );
    }

    // Force cancellation: immediately marks as CANCELED
    await this.queue.cancelJob(id);
    return { success: true, message: `Job ${id} forcefully canceled.` };
  }
}
