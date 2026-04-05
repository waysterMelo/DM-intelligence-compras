import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { CalculateQuoteTaxDto } from '../dto/calculate-quote-tax.dto';
import { TaxCalculationResultDto } from '../dto/tax-calculation-result.dto';
import { GrossCostCalculator } from './calculators/gross-cost.calculator';
import { IcmsCalculator } from './calculators/icms.calculator';
import { PisCalculator } from './calculators/pis.calculator';
import { CofinsCalculator } from './calculators/cofins.calculator';
import { IpiCalculator } from './calculators/ipi.calculator';
import { TaxMemoryMapper } from './mappers/tax-memory.mapper';
import { TaxRuleEngine, RuleMatchContext } from './rule-engine/tax-rule.engine';
import { TaxExplanationService } from './explanation/tax-explanation.service';
import { PrismaService } from '../../../prisma.service';
import { TaxHashUtil } from '../utils/tax-hash.util';
import { TaxReviewAutoService, AutoReviewContext } from '../../tax-review/services/tax-review-auto.service';

@Injectable()
export class TaxEngineService {
  constructor(
    private readonly grossCostCalculator: GrossCostCalculator,
    private readonly icmsCalculator: IcmsCalculator,
    private readonly pisCalculator: PisCalculator,
    private readonly cofinsCalculator: CofinsCalculator,
    private readonly ipiCalculator: IpiCalculator,
    private readonly taxMemoryMapper: TaxMemoryMapper,
    private readonly taxRuleEngine: TaxRuleEngine,
    private readonly taxExplanationService: TaxExplanationService,
    private readonly prisma: PrismaService,
    @Optional() private readonly reviewAutoService?: TaxReviewAutoService
  ) {}

  async calculate(dto: CalculateQuoteTaxDto): Promise<TaxCalculationResultDto> {
    const ctx = await this.buildContext(dto);

    const gross = this.grossCostCalculator.calculate(ctx);
    const icms = this.icmsCalculator.calculate(ctx);
    const pis = this.pisCalculator.calculate(ctx);
    const cofins = this.cofinsCalculator.calculate(ctx);
    const ipi = this.ipiCalculator.calculate(ctx);

    const totalCredits =
      icms.creditAmount +
      pis.creditAmount +
      cofins.creditAmount +
      ipi.creditAmount;

    const grossCostTotal = gross.grossCostTotal;
    const netCostTotal = grossCostTotal - totalCredits;
    const netCostUnit = netCostTotal / ctx.item.quantity;

    // === Fase 5: Regras dinâmicas via TaxRuleEngine ===
    const ruleCtx: RuleMatchContext = {
      supplierTaxRegime: ctx.supplier.regime,
      buyerPisCofinsRegime: ctx.buyer.pisCofinsRegime,
      itemUseType: ctx.item.itemUseType,
      operationType: ctx.item.operationType,
      buyerState: ctx.buyer.state,
      supplierState: ctx.supplier.state,
      isMonophase: ctx.item.isMonophase || false,
      isZeroRate: ctx.item.isZeroRate || false,
      isSuspended: ctx.item.isSuspended || false,
      isExempt: ctx.item.isExempt || false,
      hasIcmsSt: ctx.item.hasIcmsSt || false,
      isSupplierIcmsTaxpayer: ctx.supplier.isIcmsTaxpayer ?? true,
      isSupplierIpiTaxpayer: ctx.supplier.isIpiTaxpayer ?? false
    };

    const [ruleCodes, legalBasisStrings, hasBlocking, maxSeverity] = await Promise.all([
      this.taxRuleEngine.getAppliedRuleCodes(ruleCtx),
      this.taxRuleEngine.getAppliedLegalBasis(ruleCtx),
      this.taxRuleEngine.hasBlockingRules(ruleCtx),
      this.taxRuleEngine.getMaxSeverity(ruleCtx)
    ]);

    // Fallback: se nenhuma regra foi encontrada (catálogo vazio), usar defaults
    if (ruleCodes.length === 0) {
      ruleCodes.push('ICMS_DEFAULT', 'PIS_DEFAULT', 'COFINS_DEFAULT', 'IPI_DEFAULT');
    }

    // Fundir legalBasis dos calculadores com o do rule engine
    const allLegalBasis = [
      ...new Set([
        ...icms.legalBasis,
        ...pis.legalBasis,
        ...cofins.legalBasis,
        ...ipi.legalBasis,
        ...legalBasisStrings
      ])
    ];

    // === Fase 5: Confidence/Status dinâmicos ===
    const { confidenceLevel, calculationStatus } = this.determineGovernance(
      ctx, icms, pis, cofins, ipi, hasBlocking, maxSeverity
    );

    // === Fase 5: Explicação consistente ===
    const branches = [
      { tax: 'ICMS', baseAmount: icms.baseAmount || 0, rate: icms.rate || 0, creditAmount: icms.creditAmount, eligible: icms.eligible, disallowedReasons: icms.disallowedReasons, legalBasis: icms.legalBasis, ruleCode: ruleCodes.find(r => r.startsWith('ICMS')) || '' },
      { tax: 'PIS', baseAmount: pis.baseAmount || 0, rate: pis.rate || 0, creditAmount: pis.creditAmount, eligible: pis.eligible, disallowedReasons: pis.disallowedReasons, legalBasis: pis.legalBasis, ruleCode: ruleCodes.find(r => r.startsWith('PIS')) || '' },
      { tax: 'COFINS', baseAmount: cofins.baseAmount || 0, rate: cofins.rate || 0, creditAmount: cofins.creditAmount, eligible: cofins.eligible, disallowedReasons: cofins.disallowedReasons, legalBasis: cofins.legalBasis, ruleCode: ruleCodes.find(r => r.startsWith('COFINS')) || '' },
      { tax: 'IPI', baseAmount: ipi.baseAmount || 0, rate: ipi.rate || 0, creditAmount: ipi.creditAmount, eligible: ipi.eligible, disallowedReasons: ipi.disallowedReasons, legalBasis: ipi.legalBasis, ruleCode: ruleCodes.find(r => r.startsWith('IPI')) || '' }
    ];

    const explanation = this.taxExplanationService.generate(
      ctx, branches, gross, ruleCodes, allLegalBasis, maxSeverity
    );

    const result: TaxCalculationResultDto = {
      grossCostUnit: gross.grossCostUnit,
      grossCostTotal,
      netCostUnit,
      netCostTotal,
      credits: {
        icms: icms.creditAmount,
        pis: pis.creditAmount,
        cofins: cofins.creditAmount,
        ipi: ipi.creditAmount,
      },
      disallowedCredits: {
        icms: icms.disallowedReasons.length ? icms.disallowedReasons : undefined,
        pis: pis.disallowedReasons.length ? pis.disallowedReasons : undefined,
        cofins: cofins.disallowedReasons.length ? cofins.disallowedReasons : undefined,
        ipi: ipi.disallowedReasons.length ? ipi.disallowedReasons : undefined,
      },
      legalBasis: allLegalBasis,
      memory: this.taxMemoryMapper.build(ctx, gross, [icms, pis, cofins, ipi]),
      governance: {
        confidenceLevel,
        calculationStatus,
        ruleCodes,
        decisionSummary: {
          disallowedCredits: {
            icms: icms.disallowedReasons.length ? icms.disallowedReasons : undefined,
            pis: pis.disallowedReasons.length ? pis.disallowedReasons : undefined,
            cofins: cofins.disallowedReasons.length ? cofins.disallowedReasons : undefined,
            ipi: ipi.disallowedReasons.length ? ipi.disallowedReasons : undefined,
          },
          explanation: explanation.summary,
          blocked: explanation.blocked,
          blockReason: explanation.blockReason,
          totalCredits: explanation.totalCredits,
          netCost: explanation.netCost
        }
      },
      explanation: {
        summary: explanation.summary,
        lines: explanation.lines,
        totalCredits: explanation.totalCredits,
        grossCost: explanation.grossCost,
        netCost: explanation.netCost,
        blocked: explanation.blocked,
        blockReason: explanation.blockReason
      }
    } as any;

    return result;
  }

  /**
   * Determina confidenceLevel e calculationStatus com base nos resultados reais.
   *
   * Estados automáticos do motor:
   *   BLOCKED / BLOCKED         → regra bloqueante aplicada
   *   VALIDATED_BY_REGISTRATION/SUCCESS → todos os créditos elegíveis
   *   ESTIMATED / SUCCESS       → algum crédito não elegível (confiança reduzida)
   *
   * Intervenção humana (revisão):
   *   EXPERT_REVIEWED / SUCCESS  → após revisão com CALCULATION_ACCEPTED/ADJUSTED
   *   (mantém PENDING)           → após CALCULATION_REJECTED, exige recálculo
   */
  private determineGovernance(
    ctx: any,
    icms: any, pis: any, cofins: any, ipi: any,
    hasBlocking: boolean,
    maxSeverity: string
  ): { confidenceLevel: string; calculationStatus: string } {
    // Bloqueio total por regra BLOCKING
    if (hasBlocking) {
      return { confidenceLevel: 'BLOCKED', calculationStatus: 'BLOCKED' };
    }

    // Todos os créditos são elegíveis — máxima confiança
    const allEligible = icms.eligible && pis.eligible && cofins.eligible && ipi.eligible;
    if (allEligible) {
      return { confidenceLevel: 'VALIDATED_BY_REGISTRATION', calculationStatus: 'SUCCESS' };
    }

    // Pelo menos um crédito não é elegível — confiança reduzida
    // maxSeverity WARNING ou INFO com creditos parciais → ESTIMATED/SUCCESS
    if (maxSeverity === 'WARNING') {
      return { confidenceLevel: 'ESTIMATED', calculationStatus: 'SUCCESS' };
    }

    // Fallback para cenários não esperados
    return { confidenceLevel: 'ESTIMATED', calculationStatus: 'PENDING' };
  }

  private async buildContext(dto: CalculateQuoteTaxDto): Promise<any> {
    const buyer = await this.prisma.fornecedor.findUnique({
      where: { id: dto.buyerCompanyId }
    });

    const supplier = await this.prisma.fornecedor.findUnique({
      where: { id: dto.supplierCompanyId }
    });

    if (!buyer || !supplier) {
       throw new BadRequestException('Comprador ou Fornecedor não encontrados na base de dados');
    }

    if (!(buyer as any).pisCofinsRegime) throw new BadRequestException('Comprador sem configuração de regime PIS/COFINS');
    if ((buyer as any).isIcmsTaxpayer === undefined) throw new BadRequestException('Comprador sem configuração de isIcmsTaxpayer');
    if ((buyer as any).isIpiTaxpayer === undefined) throw new BadRequestException('Comprador sem configuração de isIpiTaxpayer');
    if (!(buyer as any).state) throw new BadRequestException('Comprador sem estado (UF) configurado');
    if (!(supplier as any).state) throw new BadRequestException('Fornecedor sem estado (UF) configurado');

    return {
      buyer: {
        id: buyer.id,
        regime: buyer.taxRegime,
        pisCofinsRegime: (buyer as any).pisCofinsRegime,
        isIcmsTaxpayer: (buyer as any).isIcmsTaxpayer,
        isIpiTaxpayer: (buyer as any).isIpiTaxpayer,
        state: (buyer as any).state
      },
      supplier: {
        id: supplier.id,
        regime: supplier.taxRegime,
        state: (supplier as any).state,
        isIcmsTaxpayer: (supplier as any).isIcmsTaxpayer,
        isIpiTaxpayer: (supplier as any).isIpiTaxpayer
      },
      item: dto.item
    };
  }

  async saveSnapshot(
    quoteId: string,
    result: TaxCalculationResultDto,
    version: string,
    inputDto: CalculateQuoteTaxDto,
    buyerCompanyId?: string
  ) {
    const auditMeta = TaxHashUtil.generateDeterministicHash(inputDto);

    // C3: Sincronizar snapshot e estado da quote
    const snapshot = await this.prisma.quoteTaxSnapshot.create({
      data: {
        quoteId,
        engineVersion: version,

        // Trilha de Auditoria Fase 2
        inputJson: auditMeta.inputJson,
        inputHash: auditMeta.hash,
        hashAlgorithm: auditMeta.algorithm,
        hashSchemaVersion: auditMeta.version,
        grossCostUnit: result.grossCostUnit,
        grossCostTotal: result.grossCostTotal,
        netCostUnit: result.netCostUnit,
        netCostTotal: result.netCostTotal,
        icmsCredit: result.credits.icms,
        pisCredit: result.credits.pis,
        cofinsCredit: result.credits.cofins,
        ipiCredit: result.credits.ipi,

        confidenceLevel: result.governance.confidenceLevel as any,
        calculationStatus: result.governance.calculationStatus as any,
        decisionSummaryJson: result.governance.decisionSummary || {},
        ruleCodesJson: result.governance.ruleCodes || [],
        legalBasisJson: result.legalBasis || [],
        memoryJson: result.memory || {}
      }
    });

    // Sincroniza a Quote atual projetada com os dados do snapshot gerado
    await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        taxConfidenceLevel: snapshot.confidenceLevel,
        taxCalculationStatus: snapshot.calculationStatus,
        lastTaxSnapshotId: snapshot.id,
        lastTaxCalculatedAt: snapshot.calculatedAt,
        lastTaxEngineVersion: snapshot.engineVersion
      }
    });

    // C1: Abertura automática de revisão (quando aplicável)
    if (this.reviewAutoService && buyerCompanyId) {
      const tenant = await this.prisma.fornecedor.findUnique({
        where: { id: buyerCompanyId },
        select: { tenantId: true }
      });

      if (tenant?.tenantId) {
        const autoCtx: AutoReviewContext = {
          tenantId: tenant.tenantId,
          buyerCompanyId,
          quoteId,
          calculationStatus: result.governance.calculationStatus,
          confidenceLevel: result.governance.confidenceLevel,
          maxSeverity: result.explanation?.lines.some(l => !l.eligible) ? 'WARNING' : 'INFO',
          totalCredits: result.explanation?.totalCredits ?? 0,
          grossCostTotal: result.grossCostTotal,
          netCost: result.netCostTotal,
          ruleCodes: result.governance.ruleCodes,
          hasBlockingRule: result.governance.calculationStatus === 'BLOCKED',
          explanationSummary: result.explanation?.summary || ''
        };

        await this.reviewAutoService.autoOpenIfApplicable(
          tenant.tenantId,
          quoteId,
          autoCtx
        );
      }
    }

    return snapshot;
  }
}
