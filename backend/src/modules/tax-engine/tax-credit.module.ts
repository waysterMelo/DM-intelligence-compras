import { Module } from '@nestjs/common';
import { TaxCreditService } from './tax-credit.service';

@Module({
  providers: [TaxCreditService],
  exports: [TaxCreditService]
})
export class TaxCreditModule {}
