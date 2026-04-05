import { Injectable } from '@nestjs/common';
import { TaxContext } from '../../interfaces/tax-context.interface';
import { TaxBranchResult } from '../../interfaces/tax-branch-result.interface';

@Injectable()
export class IcmsCalculator {
  calculate(ctx: TaxContext): TaxBranchResult {
    const defaultResult: TaxBranchResult = {
      tax: 'ICMS',
      eligible: false,
      creditAmount: 0,
      disallowedReasons: [],
      legalBasis: []
    };

    if (!ctx.buyer.isIcmsTaxpayer) {
      defaultResult.disallowedReasons.push('Comprador não é contribuinte de ICMS');
      return defaultResult;
    }

    if (ctx.item.hasIcmsSt) {
      defaultResult.disallowedReasons.push('Item sujeito a Substituição Tributária (ICMS-ST)');
      return defaultResult;
    }

    let rate = ctx.item.icmsRate || 0;
    let base = (ctx.item.unitPrice + (ctx.item.totalFreight || 0) / ctx.item.quantity) * ctx.item.quantity;

    if (ctx.supplier.regime === 'SIMPLES') {
      return this.evaluateSimplesIcmsCredit(ctx, defaultResult);
    }

    return this.evaluateNormalIcmsCredit(ctx, defaultResult, base, rate);
  }

  private evaluateSimplesIcmsCredit(ctx: TaxContext, result: TaxBranchResult): TaxBranchResult {
    result.eligible = false;
    result.creditAmount = 0;
    result.disallowedReasons.push('Fornecedor do Simples exige validação específica do art. 23 e parâmetros/documento ainda não informados');
    result.legalBasis.push('LC 123/2006 Art. 23');
    return result;
  }

  private evaluateNormalIcmsCredit(ctx: TaxContext, result: TaxBranchResult, base: number, rate: number): TaxBranchResult {
    result.legalBasis.push('Operação Normal');
    result.eligible = true;
    result.creditAmount = base * (rate / 100);
    result.formula = 'base * rate / 100';
    result.baseAmount = base;
    result.rate = rate;
    return result;
  }
}
