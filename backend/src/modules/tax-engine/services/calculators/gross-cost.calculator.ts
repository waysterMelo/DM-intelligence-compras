import { Injectable } from '@nestjs/common';
import { TaxContext } from '../../interfaces/tax-context.interface';

@Injectable()
export class GrossCostCalculator {
  calculate(ctx: TaxContext) {
    const freightUnit = (ctx.item.totalFreight || 0) / ctx.item.quantity;
    const ipiUnit = ctx.item.unitPrice * ((ctx.item.ipiRate || 0) / 100);

    const grossCostUnit = ctx.item.unitPrice + freightUnit + ipiUnit;
    const grossCostTotal = grossCostUnit * ctx.item.quantity;

    return { grossCostUnit, grossCostTotal };
  }
}
