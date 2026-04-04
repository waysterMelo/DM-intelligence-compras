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
      defaultResult.legalBasis.push('LC 123/2006 Art. 23');
    } else {
      defaultResult.legalBasis.push('Operação Normal');
    }

    defaultResult.eligible = true;
    defaultResult.creditAmount = base * (rate / 100);
    defaultResult.formula = 'base * rate / 100';
    defaultResult.baseAmount = base;
    defaultResult.rate = rate;

    return defaultResult;
  }
}
