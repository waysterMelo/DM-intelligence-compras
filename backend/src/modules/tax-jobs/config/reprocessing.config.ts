/**
 * Centralized configuration for the reprocessing queue system.
 * Values can be overridden via environment variables.
 */
export class ReprocessingConfig {
  /** Number of job items processed per batch */
  static get batchSize(): number {
    const val = parseInt(process.env.REPROCESSING_BATCH_SIZE || '10', 10);
    return isNaN(val) || val < 1 ? 10 : val;
  }

  /** Default max retries for transient errors */
  static get defaultMaxRetries(): number {
    const val = parseInt(process.env.REPROCESSING_DEFAULT_MAX_RETRIES || '3', 10);
    return isNaN(val) || val < 0 ? 3 : val;
  }

  /** Polling interval in milliseconds (for cron fallback) */
  static get pollingIntervalMs(): number {
    const val = parseInt(process.env.REPROCESSING_POLLING_INTERVAL_MS || '5000', 10);
    return isNaN(val) || val < 1000 ? 5000 : val;
  }

  /** Whether to skip items when job is cancelled (cooperative cancellation) */
  static get cooperativeCancellationEnabled(): boolean {
    return process.env.REPROCESSING_COOPERATIVE_CANCEL !== 'false';
  }
}
