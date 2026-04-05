import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma.service';

export interface RuleMatchContext {
  supplierTaxRegime: string;       // SIMPLES | PRESUMIDO | REAL
  buyerPisCofinsRegime: string;    // CUMULATIVE | NON_CUMULATIVE
  itemUseType: string;             // INDUSTRIAL_INPUT | CONSUMPTION | RESALE | FIXED_ASSET
  operationType: string;           // INTERNAL | INTERSTATE
  buyerState: string;
  supplierState: string;
  isMonophase: boolean;
  isZeroRate: boolean;
  isSuspended: boolean;
  isExempt: boolean;
  hasIcmsSt: boolean;
  isSupplierIcmsTaxpayer: boolean;
  isSupplierIpiTaxpayer: boolean;
}

export interface RuleMatchResult {
  ruleCode: string;
  ruleName: string;
  severity: string;    // BLOCKING | WARNING | INFO
  applied: boolean;
  reason: string;
}

/**
 * TaxRuleEngine — motor de casamento de regras fiscais.
 *
 * Consulta o TaxRuleCatalog e casca as condições de aplicação (appliesTo)
 * contra o contexto do cálculo, emitindo ruleCodes reais em vez de strings hardcoded.
 */
@Injectable()
export class TaxRuleEngine {
  private readonly logger = new Logger(TaxRuleEngine.name);
  private rulesCache: any[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Avalia todas as regras ativas contra o contexto e retorna as que se aplicam.
   */
  async evaluate(ctx: RuleMatchContext): Promise<RuleMatchResult[]> {
    const rules = await this.getActiveRules();
    const results: RuleMatchResult[] = [];

    for (const rule of rules) {
      const match = this.matchRule(rule, ctx);
      results.push(match);
    }

    return results;
  }

  /**
   * Retorna apenas os ruleCodes das regras que foram aplicadas (applied=true).
   */
  async getAppliedRuleCodes(ctx: RuleMatchContext): Promise<string[]> {
    const matches = await this.evaluate(ctx);
    return matches.filter(m => m.applied).map(m => m.ruleCode);
  }

  /**
   * Retorna as bases legais associadas às regras aplicadas.
   */
  async getAppliedLegalBasis(ctx: RuleMatchContext): Promise<string[]> {
    const matches = await this.evaluate(ctx);
    const basis: string[] = [];
    for (const m of matches) {
      if (m.applied) {
        basis.push(this.describeRule(m));
      }
    }
    return basis;
  }

  /**
   * Verifica se há regras BLOCKING aplicadas (impedem o cálculo).
   */
  async hasBlockingRules(ctx: RuleMatchContext): Promise<boolean> {
    const matches = await this.evaluate(ctx);
    return matches.some(m => m.applied && m.severity === 'BLOCKING');
  }

  private async getActiveRules() {
    if (this.rulesCache) return this.rulesCache;
    this.rulesCache = await this.prisma.taxRuleCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { code: 'asc' }]
    });
    return this.rulesCache;
  }

  /**
   * Invalida o cache de regras (chamar após atualizar o catálogo).
   */
  invalidateCache() {
    this.rulesCache = null;
  }

  private matchRule(rule: any, ctx: RuleMatchContext): RuleMatchResult {
    const conditions = rule.appliesTo as Record<string, any> | null;

    // Se não tem condições, regra é universal (aplica sempre)
    if (!conditions || Object.keys(conditions).length === 0) {
      return {
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity || 'INFO',
        applied: true,
        reason: 'Regra universal (sem condições específicas)'
      };
    }

    // Avaliar cada condição
    const reasons: string[] = [];
    let allMatch = true;

    for (const [key, expected] of Object.entries(conditions)) {
      const actual = (ctx as any)[key];

      if (expected === null || expected === undefined) continue;

      if (typeof expected === 'boolean') {
        if (actual !== expected) {
          allMatch = false;
          reasons.push(`${key}: esperado ${expected}, obteve ${actual}`);
        }
      } else if (Array.isArray(expected)) {
        if (!expected.includes(actual)) {
          allMatch = false;
          reasons.push(`${key}: esperado um de [${expected.join(', ')}], obteve ${actual}`);
        }
      } else {
        if (actual !== expected) {
          allMatch = false;
          reasons.push(`${key}: esperado ${expected}, obteve ${actual}`);
        }
      }
    }

    return {
      ruleCode: rule.code,
      ruleName: rule.name,
      severity: rule.severity || 'INFO',
      applied: allMatch,
      reason: allMatch
        ? 'Condições satisfeitas'
        : `Condições não satisfeitas: ${reasons.join('; ')}`
    };
  }

  private describeRule(match: RuleMatchResult): string {
    return `${match.ruleCode}: ${match.ruleName}`;
  }
}
