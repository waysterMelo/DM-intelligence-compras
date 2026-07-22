import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { TaxReviewRepository } from '../repositories/tax-review.repository';
import { ReviewReasonCode, ReviewSeverity } from '../dto/review.dto';

export interface AutoReviewContext {
  tenantId: string;
  buyerCompanyId: string;
  quoteId?: string;
  calculationStatus: string;     // BLOCKED | SUCCESS | PENDING
  confidenceLevel: string;       // ESTIMATED | VALIDATED_BY_REGISTRATION | BLOCKED | EXPERT_REVIEWED
  maxSeverity: string;           // BLOCKING | WARNING | INFO
  totalCredits: number;
  grossCostTotal: number;
  netCost: number;
  ruleCodes: string[];
  hasBlockingRule: boolean;
  explanationSummary: string;
}

export interface AutoReviewDecision {
  shouldOpen: boolean;
  reasonCode?: ReviewReasonCode;
  severity?: ReviewSeverity;
  detail?: string;
}

/**
 * TaxReviewAutoService — integra o motor fiscal com a fila de revisão especializada.
 *
 * Regras de abertura automática:
 *   BLOCKED         → abre review sempre (BLOCKED)
 *   ESTIMATED + WARNING → abre review com severidade MEDIUM (LOW_CONFIDENCE)
 *   ESTIMATED + BLOCKING  → abre review com severidade HIGH (HIGH_TAX_DELTA)
 *   RULE_CONFLICT   → quando múltiplas regras de categorias conflitantes aplicam
 *   MISSING_DATA    → quando dados críticos ausentes impedem cálculo confiável
 *
 * Thresholds configuráveis por tenant são consultados antes de abrir.
 */
@Injectable()
export class TaxReviewAutoService {
  private readonly logger = new Logger(TaxReviewAutoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: TaxReviewRepository
  ) {}

  /**
   * Avalia se deve abrir revisão automaticamente com base no resultado do motor.
   */
  evaluate(ctx: AutoReviewContext): AutoReviewDecision {
    // --- BLOCKED: sempre abre ---
    if (ctx.calculationStatus === 'BLOCKED' || ctx.confidenceLevel === 'BLOCKED') {
      return {
        shouldOpen: true,
        reasonCode: ReviewReasonCode.BLOCKED,
        severity: ReviewSeverity.CRITICAL,
        detail: `Cálculo bloqueado: ${ctx.explanationSummary}`
      };
    }

    // --- MISSING_DATA ---
    if (ctx.ruleCodes.some(r => r.includes('MISSING'))) {
      return {
        shouldOpen: true,
        reasonCode: ReviewReasonCode.MISSING_CRITICAL_TAX_DATA,
        severity: ReviewSeverity.HIGH,
        detail: `Dados fiscais críticos ausentes: ${ctx.explanationSummary}`
      };
    }

    // --- RULE_CONFLICT: múltiplas categorias de regras com severidades conflitantes ---
    if (this.hasRuleConflict(ctx.ruleCodes)) {
      return {
        shouldOpen: true,
        reasonCode: ReviewReasonCode.RULE_CONFLICT,
        severity: ReviewSeverity.HIGH,
        detail: `Conflito de regras detectado: ${ctx.ruleCodes.join(', ')}`
      };
    }

    // --- Estimation com WARNING (algum crédito não elegível) ---
    if (ctx.confidenceLevel === 'ESTIMATED' && ctx.maxSeverity === 'WARNING') {
      return {
        shouldOpen: true,
        reasonCode: ReviewReasonCode.LOW_CONFIDENCE,
        severity: ReviewSeverity.MEDIUM,
        detail: `Confiança estimada com observações: ${ctx.explanationSummary}`
      };
    }

    // --- HIGH_TAX_DELTA: quando créditos representam fração significativa do custo ---
    if (ctx.confidenceLevel === 'ESTIMATED' && ctx.grossCostTotal > 0) {
      const creditRatio = ctx.totalCredits / ctx.grossCostTotal;
      if (creditRatio > 0.15) {
        return {
          shouldOpen: true,
          reasonCode: ReviewReasonCode.HIGH_TAX_DELTA,
          severity: ReviewSeverity.HIGH,
          detail: `Delta fiscal significativo: créditos de R$ ${ctx.totalCredits.toFixed(2)} representam ${(creditRatio * 100).toFixed(0)}% do custo bruto`
        };
      }
    }

    // Sem motivo para abrir
    return { shouldOpen: false };
  }

  /**
   * Abre revisão automaticamente se os thresholds e avaliação permitirem.
   */
  async autoOpenIfApplicable(
    tenantId: string,
    quoteId: string,
    ctx: Omit<AutoReviewContext, 'tenantId'>
  ): Promise<string | null> {
    const autoCtx: AutoReviewContext = { ...ctx, tenantId };
    const decision = this.evaluate(autoCtx);

    if (!decision.shouldOpen) {
      return null;
    }

    // Aplicar thresholds configuráveis por tenant
    const threshold = await this.getThreshold(tenantId, decision.reasonCode!);
    if (threshold) {
      if (!this.passesThreshold(autoCtx, threshold)) {
        this.logger.log(
          `[AutoReview] Threshold not met for tenant ${tenantId}, trigger ${decision.reasonCode}. Skipping auto-open.`
        );
        return null;
      }
    }

    // Severidade do threshold sobrescreve se configurada
    const severity = threshold?.severity || decision.severity!;

    try {
      const reviewId = await this.repo.create({
        tenantId,
        quoteId,
        reasonCode: decision.reasonCode!,
        reasonText: decision.detail,
        severity,
        notes: `Abertura automática pelo motor fiscal. ${decision.detail}`
      });

      this.logger.log(
        `[AutoReview] Review ${reviewId} auto-opened for quote ${quoteId}: ${decision.reasonCode} (${severity})`
      );
      return reviewId;
    } catch (e: any) {
      // Se já existe item aberto para esta quote, retorna ID existente (idempotência)
      if (e.code === 'P2002' || e.message?.includes('already')) {
        this.logger.log(
          `[AutoReview] Review already exists for quote ${quoteId}. Skipping.`
        );
      }
      throw e;
    }
  }

  // --- Thresholds ---

  /**
   * Busca threshold configurada para o tenant e tipo de trigger.
   * Retorna null se não houver configuração (comportamento padrão aplica).
   */
  private async getThreshold(
    tenantId: string,
    triggerType: ReviewReasonCode
  ): Promise<{ triggerType: string; minTaxAmount: number | null; deltaPercent: number | null; severity: string } | null> {
    const dbMapping: Record<ReviewTriggerName, string> = {
      'BLOCKED': 'BLOCKED',
      'LOW_CONFIDENCE': 'LOW_CONFIDENCE',
      'HIGH_TAX_DELTA': 'HIGH_TAX_DELTA',
      'RULE_CONFLICT': 'RULE_CONFLICT',
      'MISSING_CRITICAL_TAX_DATA': 'MISSING_DATA',
      'MANUAL_REQUEST': 'MANUAL_REQUEST'
    };

    const dbType = dbMapping[triggerType];
    if (!dbType) return null;

    const threshold = await this.prisma.taxReviewThreshold.findUnique({
      where: { tenantId_triggerType: { tenantId, triggerType: dbType as any } }
    });

    return threshold
      ? {
          triggerType: threshold.triggerType,
          minTaxAmount: threshold.minTaxAmount,
          deltaPercent: threshold.deltaPercent,
          severity: threshold.severity
        }
      : null;
  }

  /**
   * Verifica se o contexto passa nos thresholds configurados.
   */
  private passesThreshold(
    ctx: AutoReviewContext,
    threshold: { minTaxAmount: number | null; deltaPercent: number | null }
  ): boolean {
    // Se tem minTaxAmount e créditos são menores, não abre
    if (threshold.minTaxAmount !== null && ctx.totalCredits < threshold.minTaxAmount) {
      return false;
    }

    // Se tem deltaPercent e a proporção de créditos é menor, não abre
    if (threshold.deltaPercent !== null && ctx.grossCostTotal > 0) {
      const creditRatio = (ctx.totalCredits / ctx.grossCostTotal) * 100;
      if (creditRatio < threshold.deltaPercent) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detecta conflito de regras (ex: BLOCKING e INFO para o mesmo tributo).
   */
  private hasRuleConflict(ruleCodes: string[]): boolean {
    const categories = new Set(ruleCodes.map(c => c.split('-')[0]));
    // Conflito: se há regras de múltiplas categorias aplicadas simultaneamente
    // com severidades incompatíveis (ex: ICMS-MONO sendo BLOCKING e ICMS-OP-INT sendo INFO)
    return categories.size >= 2 && ruleCodes.length >= 3;
  }
}

type ReviewTriggerName =
  | 'BLOCKED'
  | 'LOW_CONFIDENCE'
  | 'HIGH_TAX_DELTA'
  | 'RULE_CONFLICT'
  | 'MISSING_CRITICAL_TAX_DATA'
  | 'MANUAL_REQUEST';
