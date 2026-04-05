import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { ReprocessingConfig } from './config/reprocessing.config';
import { ReprocessingRepository, PendingJobRecord, JobItemRecord } from './repositories/reprocessing.repository';
import { ItemProcessor } from './services/item-processor.service';
import { JobConcluder } from './services/job-concluder.service';

/**
 * TaxJobsWorker — Orchestrator for the reprocessing queue.
 *
 * Responsibilities:
 * 1. Poll for queued jobs
 * 2. Lock and validate jobs
 * 3. Delegate batch processing to ItemProcessor
 * 4. Handle cooperative cancellation
 * 5. Delegate job conclusion to JobConcluder
 *
 * Does NOT directly:
 * - Process individual quotes (delegated to ItemProcessor)
 * - Determine final status (delegated to JobConcluder)
 * - Classify errors (delegated to ItemProcessor/ErrorClassifier)
 */
@Injectable()
export class TaxJobsWorker {
  private readonly logger = new Logger(TaxJobsWorker.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ReprocessingRepository,
    private readonly itemProcessor: ItemProcessor,
    private readonly jobConcluder: JobConcluder
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processNextJob();
    } catch (e: any) {
      this.logger.error(`Worker tick error: ${e.message}`, e.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  // === Main Job Lifecycle ===

  private async processNextJob() {
    const job = await this.acquireNextJob();
    if (!job) return;

    this.logger.log(
      `[Worker] Job ${job.id} acquired — tenant: ${job.tenantId}, ` +
      `buyer: ${job.buyerCompanyId}, scope: ${job.scopeType}, items: ${job.totalItems}`
    );

    const batchSize = ReprocessingConfig.batchSize;
    let batchNumber = 0;

    try {
      while (true) {
        batchNumber++;

        // Check cooperative cancellation
        if (await this.checkCancellation(job.id)) {
          await this.jobConcluder.concludeCancelled(job.id);
          return;
        }

        // Fetch next batch of pending items
        const items = await this.repository.findPendingJobItemsByJobId(job.id, batchSize);
        if (items.length === 0) break; // No more items

        this.logger.log(
          `[Worker] Job ${job.id} — Batch #${batchNumber}: processing ${items.length} items ` +
          `(batch size: ${batchSize})`
        );

        const batchResult = await this.processBatch(job, items);

        // Update job counters
        await this.repository.incrementJobCounters(
          job.id,
          batchResult.processed,
          batchResult.skipped,
          batchResult.failed
        );

        // Progress log
        const currentJob = await this.repository.getJobStatus(job.id);
        if (currentJob) {
          const progress = currentJob.totalItems > 0
            ? ((currentJob.processedItems + currentJob.skippedItems + currentJob.failedItems) / currentJob.totalItems * 100).toFixed(1)
            : '0.0';
          this.logger.log(
            `[Worker] Job ${job.id} — Batch #${batchNumber} complete: ` +
            `+${batchResult.processed} processed, +${batchResult.skipped} skipped, +${batchResult.failed} failed. ` +
            `Progress: ${progress}%`
          );
        }
      }

      // All items processed — conclude job
      const finalJob = await this.repository.getJobStatus(job.id);
      if (finalJob && finalJob.status === 'RUNNING') {
        await this.jobConcluder.conclude(finalJob);
      }
    } catch (e: any) {
      // Critical error during job processing
      this.logger.error(`[Worker] Job ${job.id} — Critical error: ${e.message}`, e.stack);
      await this.repository.concludeJob(job.id, 'FAILED');
    }
  }

  /**
   * Acquires and locks the next queued job atomically.
   * @returns The locked job record, or null if none available
   */
  private async acquireNextJob(): Promise<PendingJobRecord | null> {
    const job = await this.repository.findNextQueuedJob();
    if (!job) return null;

    const lockCount = await this.repository.lockJob(job.id);
    if (lockCount === 0) {
      this.logger.debug(`[Worker] Job ${job.id} was locked by another worker. Skipping.`);
      return null;
    }

    return job;
  }

  /**
   * Checks if the job has been cancelled cooperatively.
   * @returns true if cancelled, false otherwise
   */
  private async checkCancellation(jobId: string): Promise<boolean> {
    if (!ReprocessingConfig.cooperativeCancellationEnabled) return false;

    const status = await this.repository.getJobStatus(jobId);
    if (status?.cancelRequestedAt) {
      this.logger.log(`[Worker] Job ${jobId} — Cancellation detected at ${status.cancelRequestedAt}. Stopping.`);
      return true;
    }

    return false;
  }

  /**
   * Processes a batch of items.
   * @returns Counts of processed, skipped, and failed items
   */
  private async processBatch(
    job: PendingJobRecord,
    items: JobItemRecord[]
  ): Promise<{ processed: number; skipped: number; failed: number }> {
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const result = await this.itemProcessor.process(
          item.id,
          item.quoteId,
          job.buyerCompanyId
        );

        if (result.status === 'SKIPPED') {
          await this.repository.markItemSkipped(item.id, {
            skipReason: result.skipReason!,
            oldSnapshotId: result.oldSnapshotId,
            oldInputHash: result.oldInputHash,
            newInputHash: result.newHash
          });
          skipped++;
        } else {
          await this.repository.markItemProcessed(item.id, {
            oldSnapshotId: result.oldSnapshotId,
            newSnapshotId: result.newSnapshotId!,
            oldInputHash: result.oldInputHash,
            newInputHash: result.newHash
          });
          processed++;
        }
      } catch (e: any) {
        // Delegate retry logic to ItemProcessor
        const wasRetried = await this.itemProcessor.handleItemError(item.id, e);
        if (!wasRetried) {
          failed++;
        }
        // If wasRetried, the item is reset to PENDING — don't count as failed yet
      }
    }

    return { processed, skipped, failed };
  }
}
