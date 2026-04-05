import { Injectable } from '@nestjs/common';
import { TaxContext } from '../../interfaces/tax-context.interface';
import { RuleMatchResult } from '../rule-engine/tax-rule.engine';

export interface TaxExplanationLine {
  tax: string;                  // ICMS, PIS, COFINS, IPI
  baseValue: number;
  rate: number;
  creditAmount: number;
  eligible: boolean;
  reason: string;               // Explicação legível
  legalBasis: string[];         // Referências padronizadas (CODE — Nome)
  ruleCode: string;
}

export interface TaxExplanation {
  summary: string;              // Resumo executivo em linguagem natural
  lines: TaxExplanationLine[];
  totalCredits: number;
  grossCost: number;
  netCost: number;
  blocked: boolean;
  blockReason?: string;         // Resumo claro do bloqueio
  maxSeverity: string;          // BLOCKING | WARNING | INFO
  ruleCodes: string[];
}

/**
 * TaxExplanationService — gera explicação consistente e legível do cálculo fiscal.
 *
 * Garante que:
 * - Resumo e linhas por tributo não se contradigam
 * - Detecção de bloqueio é baseada em severidade BLOCKING
 * - Linguagem é padronizada
 * - legalBasis é sempre referências estruturadas, nunca texto livre
 */
@Injectable()
export class TaxExplanationService {
  /**
   * Gera explicação completa a partir do contexto e resultado dos ramos.
   */
  generate(
    ctx: TaxContext,
    branches: {
      tax: string;
      baseAmount: number;
      rate: number;
      creditAmount: number;
      eligible: boolean;
      disallowedReasons?: string[];
      legalBasis?: string[];
      ruleCode?: string;
    }[],
    grossCost: { grossCostUnit: number; grossCostTotal: number },
    ruleCodes: string[],
    legalBasis: string[],
    maxSeverity: string = 'INFO'
  ): TaxExplanation {
    const lines: TaxExplanationLine[] = [];
    let totalCredits = 0;

    // === Determinar bloqueio pela severidade máxima ===
    const blocked = maxSeverity === 'BLOCKING';

    for (const branch of branches) {
      const reason = this.explainBranch(branch, ctx);
      lines.push({
        tax: branch.tax,
        baseValue: branch.baseAmount,
        rate: branch.rate,
        creditAmount: branch.creditAmount,
        eligible: branch.eligible,
        reason,
        legalBasis: branch.legalBasis || [],
        ruleCode: branch.ruleCode || ''
      });

      if (branch.eligible) {
        totalCredits += branch.creditAmount;
      }
    }

    const netCost = grossCost.grossCostTotal - totalCredits;

    // Block reason: derivado das linhas bloqueantes, nunca genérico
    const blockReason = blocked ? this.findBlockReason(lines, ctx) : undefined;

    const summary = this.buildSummary(
      ctx, lines, totalCredits, grossCost, netCost, blocked, blockReason, maxSeverity
    );

    return {
      summary,
      lines,
      totalCredits,
      grossCost: grossCost.grossCostTotal,
      netCost,
      blocked,
      blockReason,
      maxSeverity,
      ruleCodes
    };
  }

  /**
   * Encontra a razão específica do bloqueio nas linhas.
   * Se não houver, retorna mensagem genérica com instrução de ação.
   */
  private findBlockReason(lines: TaxExplanationLine[], ctx: TaxContext): string {
    // Primeiro: buscar explicação concreta de tributo bloqueante
    for (const line of lines) {
      if (!line.eligible && line.creditAmount === 0) {
        return `Bloqueio fiscal: ${this.taxFullName(line.tax)} — ${line.reason}`;
      }
    }
    // Fallback operacional
    return 'Bloqueio fiscal ativo. Revise os parâmetros da operação ou consulte um especialista.';
  }

  private explainBranch(
    branch: { tax: string; eligible: boolean; creditAmount: number; disallowedReasons?: string[]; rate?: number },
    ctx: TaxContext
  ): string {
    const taxName = this.taxFullName(branch.tax);
    const rateStr = branch.rate !== undefined ? ` (alíquota ${branch.rate}%)` : '';

    if (branch.eligible && branch.creditAmount > 0) {
      return `Crédito de ${taxName}${rateStr}: R$ ${branch.creditAmount.toFixed(2)} — aproveitável. ` +
        `Regime do fornecedor: ${ctx.supplier.regime}. ` +
        `Natureza: ${ctx.item.creditNature || 'N/A'}.`;
    }

    if (branch.eligible && branch.creditAmount === 0) {
      return `${taxName}: não gera crédito${rateStr} nesta configuração. ` +
        `Regime: ${ctx.supplier.regime}, Uso: ${ctx.item.itemUseType}.`;
    }

    if (!branch.eligible) {
      const reasons = branch.disallowedReasons?.join('; ') || 'Não elegível por regras fiscais aplicáveis.';
      return `${taxName} — crédito não elegível: ${reasons}`;
    }

    return `${taxName}: cálculo realizado sem crédito direto.`;
  }

  private buildSummary(
    ctx: TaxContext,
    lines: TaxExplanationLine[],
    totalCredits: number,
    grossCost: { grossCostTotal: number },
    netCost: number,
    blocked: boolean,
    blockReason: string | undefined,
    maxSeverity: string
  ): string {
    const eligibleCount = lines.filter(l => l.eligible && l.creditAmount > 0).length;
    const disallowedCount = lines.filter(l => !l.eligible).length;

    // === Consistência: resumo deve refletir linhas, nunca divergir ===
    let summary = '';

    if (blocked) {
      summary += 'Cálculo BLOQUEADO por restrição fiscal. ';
      summary += (blockReason ? `${blockReason} ` : 'Revise os parâmetros da operação. ')
      summary += `É necessária intervenção de especialista para prosseguir.`;
    } else if (maxSeverity === 'WARNING') {
      summary += `Cálculo fiscal realizado com observações. `;
      summary += `Custo bruto: R$ ${grossCost.grossCostTotal.toFixed(2)}. `;
      if (totalCredits > 0) {
        summary += `Créditos identificados: R$ ${totalCredits.toFixed(2)} `;
        summary += `(${eligibleCount} tributo(s) com crédito).`;
      }
      if (disallowedCount > 0) {
        summary += ` ${disallowedCount} tributo(s) sem crédito elegível — revisar se aplicável.`;
      }
      if (totalCredits <= 0 && disallowedCount === 0) {
        summary += `Nenhum crédito fiscal identificado.`;
      }
    } else {
      // INFO — cenário normal
      summary += `Cálculo fiscal validado. `;
      summary += `Custo bruto: R$ ${grossCost.grossCostTotal.toFixed(2)}. `;
      if (totalCredits > 0) {
        summary += `Créditos fiscais: R$ ${totalCredits.toFixed(2)}. `;
        summary += `Custo líquido: R$ ${netCost.toFixed(2)}.`;
      } else {
        summary += `Nenhum crédito fiscal identificado nesta operação.`;
      }
    }

    return summary;
  }

  private taxFullName(tax: string): string {
    const map: Record<string, string> = {
      ICMS: 'ICMS',
      PIS: 'PIS',
      COFINS: 'COFINS',
      IPI: 'IPI'
    };
    return map[tax] || tax;
  }
}
