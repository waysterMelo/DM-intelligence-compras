import { Injectable, Logger } from '@nestjs/common';
import { TaxEngineService } from '../../tax-engine/services/tax-engine.service';
import { TaxHashUtil } from '../../tax-engine/utils/tax-hash.util';
import { CalculateQuoteTaxDto } from '../../tax-engine/dto/calculate-quote-tax.dto';
import { TAX_ENGINE_VERSION } from '../../tax-engine/controllers/tax-engine.controller';
import { ErrorClassifier } from '../utils/error-classifier';
import { ReprocessingRepository, QuoteForProcessing } from '../repositories/reprocessing.repository';

export interface ItemProcessingResult {
  status: 'SKIPPED' | 'PROCESSED';
  skipReason?: string;
  oldSnapshotId?: string | null;
  newSnapshotId?: string;
  oldInputHash?: string | null;
  newHash: string;
}

/**
 * Responsible for processing a single quote item:
 * - Fetching quote data
 * - Computing hashes
 * - Deciding whether to skip or recalculate
 * - Handling errors with per-item retry logic
 */
@Injectable()
export class ItemProcessor {
  private readonly logger = new Logger(ItemProcessor.name);

  constructor(
    private readonly repository: ReprocessingRepository,
    private readonly taxEngineService: TaxEngineService
  ) {}

  /**
   * Processes a single quote item with full tenant isolation.
   * @param tenantId — tenant do job (para validação de isolamento)
   * @returns Processing result metadata (skipped or processed)
   * @throws Error if the item failed processing (caller handles retry logic)
   */
  async process(itemId: string, quoteId: string, buyerCompanyId: string, tenantId: string): Promise<ItemProcessingResult> {
    // Mark item as started
    await this.repository.startItem(itemId);

    // Fetch quote with tenant-scoped validation (ponta a ponta)
    const quote = await this.repository.findQuoteForProcessingTenantScoped(quoteId, tenantId);
    if (!quote || !quote.fornecedorId) {
      throw new Error(`Quote ${quoteId} not found, supplier missing, or does not belong to tenant ${tenantId}`);
    }

    // Build calculation DTO using the job's buyerCompanyId (deterministic, not global lookup)
    const dto = this.buildCalculateDto(quote, buyerCompanyId);

    // Generate new deterministic hash
    const newHashMeta = TaxHashUtil.generateDeterministicHash(dto);
    const newHash = newHashMeta.hash;
    const oldSnapshotId = quote.lastTaxSnapshotId;

    // Fetch old hash from existing snapshot
    let oldInputHash: string | null = null;
    if (oldSnapshotId) {
      const oldSnap = await this.repository.getSnapshotHash(oldSnapshotId);
      if (oldSnap) oldInputHash = oldSnap.inputHash;
    }

    // Smart skip: if input hash unchanged, skip calculation
    if (oldInputHash === newHash) {
      this.logger.debug(`[ItemProcessor] Item ${itemId}: SKIPPED (hash unchanged)`);
      return {
        status: 'SKIPPED',
        skipReason: 'INPUT_HASH_UNCHANGED',
        oldSnapshotId,
        oldInputHash,
        newHash
      };
    }

    // Hash changed: recalculate via tax engine
    const result = await this.taxEngineService.calculate(dto);
    const newSnap = await this.taxEngineService.saveSnapshot(quoteId, result, TAX_ENGINE_VERSION, dto);

    this.logger.debug(`[ItemProcessor] Item ${itemId}: PROCESSED (new snapshot: ${newSnap.id})`);
    return {
      status: 'PROCESSED',
      oldSnapshotId,
      newSnapshotId: newSnap.id,
      oldInputHash,
      newHash
    };
  }

  /**
   * Builds the CalculateQuoteTaxDto from quote data.
   */
  private buildCalculateDto(quote: QuoteForProcessing, buyerCompanyId: string): CalculateQuoteTaxDto {
    return {
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
  }

  /**
   * Handles a failed item: classifies error as transient or definitive,
   * and applies per-item retry logic.
   *
   * @returns true if the item was retried (reset to PENDING), false if it was marked as FAILED
   */
  async handleItemError(itemId: string, error: Error): Promise<boolean> {
    const isTransient = ErrorClassifier.isTransient(error);
    const errorMessage = error.message || 'Unknown error';

    if (!isTransient) {
      // Definitive error: mark as failed immediately
      this.logger.warn(`[ItemProcessor] Item ${itemId}: FAILED (definitive error: ${errorMessage})`);
      await this.repository.markItemFailed(itemId, errorMessage);
      return false;
    }

    // Transient error: check retry count
    const retryInfo = await this.repository.incrementItemRetry(itemId);
    if (!retryInfo) {
      this.logger.warn(`[ItemProcessor] Item ${itemId}: FAILED (item not found for retry check)`);
      await this.repository.markItemFailed(itemId, errorMessage);
      return false;
    }

    if (retryInfo.retryCount >= retryInfo.maxRetries) {
      // Max retries exceeded
      this.logger.error(
        `[ItemProcessor] Item ${itemId}: FAILED (max retries ${retryInfo.maxRetries} exceeded). ` +
        `Error: ${errorMessage}`
      );
      await this.repository.markItemFailed(itemId, `Max retries exceeded. Last error: ${errorMessage}`);
      return false;
    }

    // Retry: reset item to PENDING for next batch
    this.logger.warn(
      `[ItemProcessor] Item ${itemId}: RETRY ${retryInfo.retryCount}/${retryInfo.maxRetries} ` +
      `(transient: ${errorMessage}). Resetting to PENDING.`
    );
    await this.repository.resetItemToPending(itemId, `[RETRY ${retryInfo.retryCount}/${retryInfo.maxRetries}] ${errorMessage}`);
    return true;
  }
}
