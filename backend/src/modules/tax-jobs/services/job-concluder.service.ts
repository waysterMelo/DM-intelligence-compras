import { Injectable, Logger } from '@nestjs/common';
import { ReprocessingRepository, PendingJobRecord } from '../repositories/reprocessing.repository';

/**
 * Determines the final status of a job and persists it.
 *
 * Status semantics:
 * - COMPLETED: all items successfully processed or legitimately skipped (hash unchanged)
 * - COMPLETED_ALL_SKIPPED: all items were skipped with no input change (no recalculation needed)
 * - PARTIAL: some items processed, some failed
 * - FAILED: all items failed (or none processed with at least one failure)
 * - CANCELED: job was cancelled (handled separately)
 */
@Injectable()
export class JobConcluder {
  private readonly logger = new Logger(JobConcluder.name);

  constructor(private readonly repository: ReprocessingRepository) {}

  /**
   * Determines and persists the final status of a completed job.
   * @returns The determined status string
   */
  async conclude(job: PendingJobRecord): Promise<string> {
    const { totalItems, processedItems, skippedItems, failedItems } = job;
    const status = this.determineStatus(totalItems, processedItems, skippedItems, failedItems);

    await this.repository.concludeJob(job.id, status);

    this.logger.log(
      `[JobConcluder] Job ${job.id} concluded: ${status} ` +
      `(total: ${totalItems}, processed: ${processedItems}, skipped: ${skippedItems}, failed: ${failedItems})`
    );

    return status;
  }

  private determineStatus(
    totalItems: number,
    processedItems: number,
    skippedItems: number,
    failedItems: number
  ): string {
    // No items to process
    if (totalItems === 0) return 'COMPLETED_ALL_SKIPPED';

    // Everything failed
    if (failedItems === totalItems) return 'FAILED';

    // Everything was skipped, nothing was processed
    if (processedItems === 0 && skippedItems === totalItems) return 'COMPLETED_ALL_SKIPPED';

    // Mixed: some processed, some failed
    if (failedItems > 0 && processedItems > 0) return 'PARTIAL';

    // All failed, none processed
    if (failedItems > 0 && processedItems === 0) return 'FAILED';

    // All processed or skipped with no failures
    return 'COMPLETED';
  }

  /**
   * Concludes a cancelled job, marking remaining PENDING items as skipped.
   */
  async concludeCancelled(jobId: string): Promise<void> {
    await this.repository.cancelRemainingItems(jobId);
    await this.repository.concludeJob(jobId, 'CANCELED');
    this.logger.log(`[JobConcluder] Job ${jobId} concluded as CANCELED. Remaining items marked as SKIPPED.`);
  }
}
