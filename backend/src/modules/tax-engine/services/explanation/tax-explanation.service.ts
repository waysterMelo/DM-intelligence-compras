import { Injectable } from '@nestjs/common';
import { TaxContext } from '../../interfaces/tax-context.interface';

export interface TaxExplanationLine {
  tax: string;                  // ICMS, PIS, COFINS, IPI
  baseValue: number;
  rate: number;
  creditAmount: number;
  eligible: boolean;
  reason: string;               // Explicação legível
  legalBasis: string[];
  ruleCode: string;
}

export interface TaxExplanation {
  summary: string;              // Resumo executivo em linguagem natural
  lines: TaxExplanationLine[];
  totalCredits: number;
  grossCost: number;
  netCost: number;
  blocked: boolean;
  blockReason?: string;
}

/**
 * TaxExplanationService — gera explicação consistente e legível do cálculo fiscal.
 *
 * Transforma o resultado técnico em linguagem natural para auditores e compradores.
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
    legalBasis: string[]
  ): TaxExplanation {
    const lines: TaxExplanationLine[] = [];
    let totalCredits = 0;
    let blocked = false;
    let blockReason: string | undefined;

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

      if (!branch.eligible && branch.disallowedReasons?.length) {
        // Verifica se é bloqueio total
        if (branch.tax === 'ICMS' && branch.creditAmount === 0) {
          blocked = true;
          blockReason = branch.disallowedReasons[0];
        }
      }
    }

    const netCost = grossCost.grossCostTotal - totalCredits;
    const summary = this.buildSummary(ctx, lines, totalCredits, grossCost, netCost, blocked);

    return {
      summary,
      lines,
      totalCredits,
      grossCost: grossCost.grossCostTotal,
      netCost,
      blocked,
      blockReason
    };
  }

  private explainBranch(
    branch: { tax: string; eligible: boolean; creditAmount: number; disallowedReasons?: string[] },
    ctx: TaxContext
  ): string {
    const taxName = this.taxFullName(branch.tax);

    if (branch.eligible && branch.creditAmount > 0) {
      return `Crédito de ${taxName} de R$ ${branch.creditAmount.toFixed(2)} é aproveitável. ` +
        `Regime do fornecedor: ${ctx.supplier.regime}. ` +
        `Natureza: ${ctx.item.creditNature || 'N/A'}.`;
    }

    if (branch.eligible && branch.creditAmount === 0) {
      return `${taxName} não gera crédito nesta operação. ` +
        `Regime: ${ctx.supplier.regime}, Uso: ${ctx.item.itemUseType}.`;
    }

    if (!branch.eligible) {
      const reasons = branch.disallowedReasons?.join('; ') || 'Não elegível por regras fiscais.';
      return `Crédito de ${taxName} NÃO elegível: ${reasons}`;
    }

    return `${taxName}: cálculo realizado sem crédito direto.`;
  }

  private buildSummary(
    ctx: TaxContext,
    lines: TaxExplanationLine[],
    totalCredits: number,
    grossCost: { grossCostTotal: number },
    netCost: number,
    blocked: boolean
  ): string {
    const supplier = (ctx as any).supplierName || 'Fornecedor';
    const eligibleCount = lines.filter(l => l.eligible && l.creditAmount > 0).length;
    const disallowedCount = lines.filter(l => !l.eligible).length;

    let summary = `Cálculo fiscal para compra com ${supplier}. `;
    summary += `Custo bruto total: R$ ${grossCost.grossCostTotal.toFixed(2)}. `;

    if (blocked) {
      summary += `ATENÇÃO: Cálculo BLOQUEADO por restrição fiscal. `;
      summary += `Revise os parâmetros da operação antes de prosseguir.`;
    } else if (totalCredits > 0) {
      summary += `Foram identificados R$ ${totalCredits.toFixed(2)} em créditos fiscais `;
      summary += `(${eligibleCount} tributo(s) com crédito aproveitável`;
      if (disallowedCount > 0) {
        summary += `, ${disallowedCount} tributo(s) sem crédito`;
      }
      summary += `). Custo líquido estimado: R$ ${netCost.toFixed(2)}.`;
    } else {
      summary += `Nenhum crédito fiscal identificado nesta operação.`;
      if (disallowedCount > 0) {
        summary += ` ${disallowedCount} tributo(s) tiveram crédito não elegível.`;
      }
    }

    return summary;
  }

  private taxFullName(tax: string): string {
    const map: Record<string, string> = {
      ICMS: 'ICMS (Imposto sobre Circulação de Mercadorias e Serviços)',
      PIS: 'PIS (Programa de Integração Social)',
      COFINS: 'COFINS (Contribuição para o Financiamento da Seguridade Social)',
      IPI: 'IPI (Imposto sobre Produtos Industrializados)'
    };
    return map[tax] || tax;
  }
}
