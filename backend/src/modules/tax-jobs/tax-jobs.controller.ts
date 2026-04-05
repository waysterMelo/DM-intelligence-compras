import { Controller, Post, Get, Param, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { ReprocessingQueuePort } from './ports/reprocessing-queue.port';

@Controller('tax-governance/reprocess-jobs')
export class TaxJobsController {
  constructor(private readonly queue: ReprocessingQueuePort) {}

  @Post()
  async createJob(@Body() body: any) {
    // Validações pesadas de Segurança Fase 3
    if (!body.requestedByUserId) throw new BadRequestException('requestedByUserId is required');
    if (!body.reason) throw new BadRequestException('reason is required for auditing');
    if (!body.scopeType) throw new BadRequestException('scopeType is required (QUOTE, COMPANY, DATE_RANGE, ENGINE_VERSION, TENANT_ALL)');

    const jobId = await this.queue.createJob({
      tenantId: body.tenantId,
      requestedByUserId: body.requestedByUserId,
      scopeType: body.scopeType,
      scopePayloadJson: body.scopePayloadJson || {},
      reason: body.reason,
      engineVersionFrom: body.engineVersionFrom,
      engineVersionTo: body.engineVersionTo
    });

    return { success: true, jobId, message: 'Job scheduled successfully. It will be executed asynchronously.' };
  }

  @Get()
  async listJobs() {
    return this.queue.getPendingJobs();
  }

  @Get(':id')
  async getJobInfo(@Param('id') id: string) {
    const job = await this.queue.getJobProgress(id);
    if (!job) throw new BadRequestException('Job not found');
    return job;
  }

  @Post(':id/cancel')
  async cancelJob(@Param('id') id: string) {
    await this.queue.cancelJob(id);
    return { success: true, message: `Job ${id} canceled` };
  }
}
