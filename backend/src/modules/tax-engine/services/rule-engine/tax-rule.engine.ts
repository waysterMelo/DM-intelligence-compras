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
 * Semântica das regras no catálogo:
 *
 * **Regra universal (BLOCKING):**
 *   — Não tem condições (appliesTo vazio/null) e severity = BLOCKING
 *   — Aplica-se a TODOS os cálculos; se aplicada, bloqueia o cálculo.
 *
 * **Regra bloqueante (BLOCKING):**
 *   — Tem condições (appliesTo) e severity = BLOCKING
 *   — Quando match, impede o cálculo e exige intervenção.
 *
 * **Regra de advertência (WARNING):**
 *   — Quando match, alerta que crédito pode estar reduzido ou inexistente.
 *
 * **Regra informativa (INFO):**
 *   — Descreve comportamento normal do sistema; sem impacto no status.
 *
 * Prioridade de avaliação:
 *   1. BLOCKING (ordem alfabética de code) — se alguma match → cálculo bloqueado
 *   2. WARNING  (ordem alfabética de code)
 *   3. INFO     (ordem alfabética de code)
 *
 * Quando múltiplas regras match:
 *   — severity máxima vence para determinar status governança
 *   — todas as ruleCodes aplicadas são devolvidas (rastreabilidade completa)
 */
@Injectable()
export class TaxRuleEngine {
  private readonly logger = new Logger(TaxRuleEngine.name);
  private rulesCache: any[] | null = null;

  // Ordem de prioridade das severidades
  private readonly SEVERITY_ORDER: Record<string, number> = {
    BLOCKING: 1,
    WARNING:  2,
    INFO:     3
  };

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(ctx: RuleMatchContext): Promise<RuleMatchResult[]> {
    const rules = await this.getActiveRules();
    const results: RuleMatchResult[] = [];

    for (const rule of rules) {
      const match = this.matchRule(rule, ctx);
      results.push(match);
    }

    // Ordenar por severidade (BLOCKING primeiro) e depois por code
    results.sort((a, b) => {
      const svA = this.SEVERITY_ORDER[a.severity] ?? 99;
      const svB = this.SEVERITY_ORDER[b.severity] ?? 99;
      if (svA !== svB) return svA - svB;
      return a.ruleCode.localeCompare(b.ruleCode);
    });

    return results;
  }

  async getAppliedRuleCodes(ctx: RuleMatchContext): Promise<string[]> {
    const matches = await this.evaluate(ctx);
    return matches.filter(m => m.applied).map(m => m.ruleCode);
  }

  async getAppliedLegalBasis(ctx: RuleMatchContext): Promise<string[]> {
    const matches = await this.evaluate(ctx);
    const basis: string[] = [];
    for (const m of matches) {
      if (m.applied) {
        basis.push(this.formatLegalBasis(m));
      }
    }
    return basis;
  }

  async hasBlockingRules(ctx: RuleMatchContext): Promise<boolean> {
    const matches = await this.evaluate(ctx);
    return matches.some(m => m.applied && m.severity === 'BLOCKING');
  }

  /**
   * Retorna a severidade máxima entre as regras aplicadas.
   */
  async getMaxSeverity(ctx: RuleMatchContext): Promise<string> {
    const matches = await this.evaluate(ctx);
    const applied = matches.filter(m => m.applied);
    if (applied.length === 0) return 'INFO';

    // Ordenar por prioridade — BLOCKING é o mais alto
    const sorted = [...applied].sort((a, b) => {
      const svA = this.SEVERITY_ORDER[a.severity] ?? 99;
      const svB = this.SEVERITY_ORDER[b.severity] ?? 99;
      return svA - svB;
    });
    return sorted[0].severity;
  }

  /**
   * Invalida o cache de regras (chamar após atualizar o catálogo).
   */
  invalidateCache() {
    this.rulesCache = null;
  }

  private async getActiveRules() {
    if (this.rulesCache) return this.rulesCache;
    this.rulesCache = await this.prisma.taxRuleCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { code: 'asc' }]
    });
    return this.rulesCache;
  }

  private matchRule(rule: any, ctx: RuleMatchContext): RuleMatchResult {
    const conditions = rule.appliesTo as Record<string, any> | null;

    // Regra universal (sem condições)
    if (!conditions || Object.keys(conditions).length === 0) {
      return {
        ruleCode: rule.code,
        ruleName: rule.name,
        severity: rule.severity || 'INFO',
        applied: true,
        reason: 'Regra universal (sem condições específicas)'
      };
    }

    // Avaliar cada condição — TODAS devem match (AND lógico)
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

  /**
   * Formata a base legal de forma padronizada: `CODE — Nome`.
   * Evita texto livre; mantém formato consumível por dashboard e auditoria.
   */
  private formatLegalBasis(match: RuleMatchResult): string {
    return `${match.ruleCode} — ${match.ruleName}`;
  }
}
