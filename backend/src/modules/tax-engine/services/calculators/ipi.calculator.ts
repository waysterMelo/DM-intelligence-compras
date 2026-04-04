import { Injectable } from '@nestjs/common';
import { TaxContext } from '../../interfaces/tax-context.interface';
import { TaxBranchResult } from '../../interfaces/tax-branch-result.interface';

@Injectable()
export class IpiCalculator {
  calculate(ctx: TaxContext): TaxBranchResult {
    const defaultResult: TaxBranchResult = {
      tax: 'IPI',
      eligible: false,
      creditAmount: 0,
      disallowedReasons: [],
      legalBasis: []
    };

    if (!ctx.buyer.isIpiTaxpayer) {
      defaultResult.disallowedReasons.push('Comprador não é aproveitador de IPI');
      return defaultResult;
    }

    if (ctx.item.itemUseType !== 'INDUSTRIAL_INPUT') {
      defaultResult.disallowedReasons.push('IPI exige uso e consumo como INSUMO INDUSTRIAL');
      return defaultResult;
    }

    let rate = ctx.item.ipiRate || 0;
    let base = ctx.item.unitPrice * ctx.item.quantity;
    
    defaultResult.eligible = true;
    defaultResult.creditAmount = base * (rate / 100);
    defaultResult.formula = 'base * rate / 100';
    defaultResult.baseAmount = base;
    defaultResult.rate = rate;

    return defaultResult;
  }
}
