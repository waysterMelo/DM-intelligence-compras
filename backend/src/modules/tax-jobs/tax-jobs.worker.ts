import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { TaxEngineService } from '../tax-engine/services/tax-engine.service';
import { TaxHashUtil } from '../tax-engine/utils/tax-hash.util';
import { CalculateQuoteTaxDto } from '../tax-engine/dto/calculate-quote-tax.dto';
import { TAX_ENGINE_VERSION } from '../tax-engine/controllers/tax-engine.controller';
import { ReprocessingConfig } from './config/reprocessing.config';
import { ErrorClassifier } from './utils/error-classifier';
import { ReprocessingRepository } from './repositories/reprocessing.repository';

@Injectable()
export class TaxJobsWorker {
  private readonly logger = new Logger(TaxJobsWorker.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly taxEngineService: TaxEngineService,
    private readonly repository: ReprocessingRepository
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.processNextJob();
    } catch (e: any) {
      this.logger.error(`Error in TaxJobsWorker: ${e.message}`, e.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNextJob() {
    // 1. Find next queued job
    const job = await this.repository.findNextQueuedJob();
    if (!job) return;

    // 2. Atomic lock
    const lockCount = await this.repository.lockJob(job.id);
    if (lockCount === 0) return; // Another worker took it

    this.logger.log(`[Worker] Started processing Job ${job.id} (tenant: ${job.tenantId}, buyer: ${job.buyerCompanyId})`);

    // 3. Process items in batches
    const batchSize = ReprocessingConfig.batchSize;
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    while (true) {
      // Cooperative cancellation check
      if (ReprocessingConfig.cooperativeCancellationEnabled) {
        const currentStatus = await this.repository.getJobStatus(job.id);
        if (!currentStatus || currentStatus.cancelRequestedAt) {
          this.logger.log(`[Worker] Job ${job.id} cancelled cooperatively. Stopping processing.`);
          // Mark remaining PENDING items as SKIPPED with CANCELLED reason
          await this.cancelRemainingItems(job.id);
          await this.repository.concludeJob(job.id, 'CANCELED');
          return;
        }
      }

      // Fetch next batch
      const items = await this.repository.findPendingJobItemsByJobId(job.id, batchSize);
      if (items.length === 0) break; // No more items

      let batchProcessed = 0;
      let batchSkipped = 0;
      let batchFailed = 0;

      for (const item of items) {
        try {
          const result = await this.processItem(item.quoteId, item.id, job.buyerCompanyId);

          if (result.status === 'SKIPPED') {
            await this.repository.markItemSkipped(item.id, {
              skipReason: result.skipReason!,
              oldSnapshotId: result.oldSnapshotId,
              oldInputHash: result.oldInputHash,
              newInputHash: result.newHash
            });
            batchSkipped++;
          } else if (result.status === 'PROCESSED') {
            await this.repository.markItemProcessed(item.id, {
              oldSnapshotId: result.oldSnapshotId,
              newSnapshotId: result.newSnapshotId!,
              oldInputHash: result.oldInputHash,
              newInputHash: result.newHash
            });
            batchProcessed++;
          }
        } catch (e: any) {
          const isTransient = ErrorClassifier.isTransient(e);
          const errorMessage = e.message || 'Unknown error';

          if (isTransient && job.retryCount < job.maxRetries) {
            // Transient error: mark for retry, don't fail item yet
            this.logger.warn(
              `[Worker] Transient error on item ${item.id} (quote: ${item.quoteId}): ${errorMessage}. Will retry.`
            );
            // Don't mark as failed; leave as PENDING for retry
            // Increment job retry counter
            await this.prisma.taxReprocessingJob.update({
              where: { id: job.id },
              data: { retryCount: { increment: 1 } }
            });
            batchFailed++; // Count toward this batch
          } else {
            // Definitive error or max retries exceeded
            await this.repository.markItemFailed(item.id, errorMessage);
            batchFailed++;
          }
        }
      }

      // Update job counters
      await this.repository.incrementJobCounters(job.id, batchProcessed, batchSkipped, batchFailed);
      totalProcessed += batchProcessed;
      totalSkipped += batchSkipped;
      totalFailed += batchFailed;
    }

    // 4. Conclude job with proper status semantics
    const finalJob = await this.repository.getJobStatus(job.id);
    if (finalJob && finalJob.status === 'RUNNING') {
      const status = this.determineFinalStatus(finalJob);
      await this.repository.concludeJob(job.id, status);
      this.logger.log(
        `[Worker] Job ${job.id} concluded with status=${status} ` +
        `(processed: ${finalJob.processedItems}, skipped: ${finalJob.skippedItems}, failed: ${finalJob.failedItems})`
      );
    }
  }

  /**
   * Process a single quote item.
   * Returns the result metadata for database update.
   */
  private async processItem(quoteId: string, itemId: string, buyerCompanyId: string) {
    // Start item
    await this.repository.startItem(itemId);

    // Fetch quote
    const quote = await this.repository.findQuoteForProcessing(quoteId);
    if (!quote || !quote.fornecedorId) {
      throw new Error(`Quote ${quoteId} or supplier not found`);
    }

    // Build calculation DTO using the job's buyerCompanyId (deterministic, not global lookup)
    const dto: CalculateQuoteTaxDto = {
      buyerCompanyId,
      supplierCompanyId: quote.fornecedorId,
      item: {
        quantity: quote.requisition.quantity,
        unitPrice: quote.price,
        totalFreight: quote.freight || 0,
        itemUseType: quote.itemUseType as any,
        creditNature: quote.creditNature as any,
        operationType: quote.operationType as any,
        ipiRate: quote.ipiRate || 0,
        icmsRate: quote.icmsRate || 0,
        pisRate: quote.pisRate || 0,
        cofinsRate: quote.cofinsRate || 0,
        hasIcmsSt: quote.hasIcmsSt || false
      }
    };

    // Generate new hash
    const newHashMeta = TaxHashUtil.generateDeterministicHash(dto);
    const newHash = newHashMeta.hash;
    const oldSnapshotId = quote.lastTaxSnapshotId;

    // Fetch old hash
    let oldInputHash: string | null = null;
    if (oldSnapshotId) {
      const oldSnap = await this.repository.getSnapshotHash(oldSnapshotId);
      if (oldSnap) oldInputHash = oldSnap.inputHash;
    }

    // Smart skip: if hash unchanged, skip calculation
    if (oldInputHash === newHash) {
      return {
        status: 'SKIPPED' as const,
        skipReason: 'INPUT_HASH_UNCHANGED',
        oldSnapshotId,
        oldInputHash,
        newHash
      };
    }

    // Hash changed: recalculate
    const result = await this.taxEngineService.calculate(dto);
    const newSnap = await this.taxEngineService.saveSnapshot(quoteId, result, TAX_ENGINE_VERSION, dto);

    return {
      status: 'PROCESSED' as const,
      oldSnapshotId,
      newSnapshotId: newSnap.id,
      oldInputHash,
      newHash
    };
  }

  /**
   * Determines the final status of a job based on counters.
   * - COMPLETED: all items processed or skipped, no failures
   * - COMPLETED_ALL_SKIPPED: all items were skipped (no recalculation happened)
   * - PARTIAL: some processed, some failed
   * - FAILED: all items failed
   */
  private determineFinalStatus(job: any): string {
    const { totalItems, processedItems, skippedItems, failedItems } = job;

    if (totalItems === 0) return 'COMPLETED_ALL_SKIPPED';

    if (failedItems === totalItems) return 'FAILED';

    if (processedItems === 0 && skippedItems === totalItems) return 'COMPLETED_ALL_SKIPPED';

    if (failedItems > 0 && processedItems > 0) return 'PARTIAL';

    if (failedItems > 0 && processedItems === 0) return 'FAILED';

    return 'COMPLETED';
  }

  /**
   * Marks all remaining PENDING items as skipped due to cancellation.
   */
  private async cancelRemainingItems(jobId: string) {
    await this.prisma.taxReprocessingJobItem.updateMany({
      where: { jobId, status: 'PENDING' },
      data: { status: 'SKIPPED', skipReason: 'JOB_CANCELLED', finishedAt: new Date() }
    });
  }
}
