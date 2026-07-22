import { Injectable } from '@nestjs/common';
import { TaxContext } from '../../interfaces/tax-context.interface';
import { TaxBranchResult } from '../../interfaces/tax-branch-result.interface';

@Injectable()
export class TaxMemoryMapper {
  build(ctx: TaxContext, gross: any, branches: TaxBranchResult[]) {
    return {
      context: ctx,
      grossCost: gross,
      branches: branches.map(b => ({
        tax: b.tax,
        eligible: b.eligible,
        creditAmount: b.creditAmount,
        disallowedReasons: b.disallowedReasons,
        legalBasis: b.legalBasis,
        formula: b.formula,
        baseAmount: b.baseAmount,
        rate: b.rate
      }))
    };
  }
}
