import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
  UseGuards,
  Request,
  Req
} from '@nestjs/common';
import { ReprocessingQueuePort } from './ports/reprocessing-queue.port';
import { CreateJobDto } from './dto/create-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

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
  constructor(private readonly queue: ReprocessingQueuePort) {}

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
  async listJobs(@Req() req: AuthenticatedRequest) {
    // Filter by tenant if present in auth context
    const tenantId = req.user.tenantId;
    return this.queue.getPendingJobs(tenantId);
  }

  @Get(':id')
  async getJobInfo(@Param('id') id: string) {
    const job = await this.queue.getJobProgress(id);
    if (!job) throw new BadRequestException('Job not found');
    return job;
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  async cancelJob(@Param('id') id: string) {
    // Cooperative cancellation: allows in-progress work to finish gracefully
    await this.queue.cancelJobCooperative(id);
    return { success: true, message: `Cancellation requested for job ${id}. In-progress work will finish gracefully.` };
  }

  @Post(':id/cancel-force')
  @Roles('ADMIN')
  async forceCancelJob(@Param('id') id: string) {
    // Force cancellation: immediately marks as CANCELED
    await this.queue.cancelJob(id);
    return { success: true, message: `Job ${id} forcefully canceled.` };
  }
}
