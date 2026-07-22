/**
 * Classifies errors to determine if they are retryable (transient) or definitive (business errors).
 */
export class ErrorClassifier {
  /**
   * Transient errors: database connection timeout, network issues, rate limits, etc.
   * These are worth retrying.
   */
  private static TRANSIENT_PATTERNS = [
    /timeout/i,
    /connection.*refused/i,
    /connection.*reset/i,
    /network/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /socket.*hang.*up/i,
    /rate.*limit/i,
    /too.*many.*requests/i,
    /deadlock/i,
    /lock.*timeout/i,
    /P2024/,   // Prisma: Row lock not available (temporary)
    /P2034/,   // Prisma: Transaction write conflict
  ];

  /**
   * Definitive errors: validation, not found, constraint violations, etc.
   * Retrying these won't help.
   */
  private static DEFINITIVE_PATTERNS = [
    /not.*found/i,
    /does.*not.*exist/i,
    /unique.*constraint/i,
    /foreign.*key/i,
    /validation/i,
    /invalid/i,
    /required/i,
    /P2002/,   // Prisma: Unique constraint failed
    /P2003/,   // Prisma: Foreign key constraint failed
    /P2025/,   // Prisma: Record not found
  ];

  static isTransient(error: Error | any): boolean {
    const message = error?.message || String(error);
    return this.TRANSIENT_PATTERNS.some(p => p.test(message));
  }

  static isDefinitive(error: Error | any): boolean {
    return !this.isTransient(error);
  }
}
