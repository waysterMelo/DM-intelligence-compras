import { Injectable } from '@nestjs/common';
import { TaxContext } from '../../interfaces/tax-context.interface';
import { TaxBranchResult } from '../../interfaces/tax-branch-result.interface';

@Injectable()
export class PisCalculator {
  calculate(ctx: TaxContext): TaxBranchResult {
    const defaultResult: TaxBranchResult = {
      tax: 'PIS',
      eligible: false,
      creditAmount: 0,
      disallowedReasons: [],
      legalBasis: []
    };

    if (ctx.buyer.pisCofinsRegime !== 'NON_CUMULATIVE') {
      defaultResult.disallowedReasons.push('Comprador não está no regime de Não Cumulatividade');
      return defaultResult;
    }

    if (ctx.item.isMonophase || ctx.item.isZeroRate || ctx.item.isSuspended) {
      defaultResult.disallowedReasons.push('Item sujeito a regime monofásico, alíquota zero ou suspenso');
      return defaultResult;
    }

    switch (ctx.item.creditNature) {
      case 'INSUMO':
      case 'FREIGHT':
      case 'DEPRECIATION':
      case 'RESALE':
        defaultResult.eligible = true;
        break;
      default:
        defaultResult.disallowedReasons.push('Natureza de crédito não elegível (apenas INSUMO, FREIGHT, DEPRECIATION, RESALE)');
        return defaultResult;
    }

    let rate = ctx.item.pisRate || 0;
    let base = (ctx.item.unitPrice + (ctx.item.totalFreight || 0) / ctx.item.quantity) * ctx.item.quantity;

    defaultResult.creditAmount = base * (rate / 100);
    defaultResult.formula = 'base * rate / 100';
    defaultResult.baseAmount = base;
    defaultResult.rate = rate;

    defaultResult.legalBasis.push('versionScope: V1 structured estimate');
    return defaultResult;
  }
}
