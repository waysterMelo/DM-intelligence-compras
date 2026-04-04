import { Controller, Post, Body, Param } from '@nestjs/common';
import { TaxEngineService } from '../services/tax-engine.service';
import { CalculateQuoteTaxDto } from '../dto/calculate-quote-tax.dto';

@Controller('tax')
export class TaxEngineController {
  constructor(private readonly taxEngineService: TaxEngineService) {}

  @Post('calculate-quote')
  async calculateQuote(@Body() dto: CalculateQuoteTaxDto) {
    return this.taxEngineService.calculate(dto);
  }

  @Post('quotes/:id/tax-snapshot')
  async createSnapshot(@Param('id') id: string, @Body() dto: CalculateQuoteTaxDto) {
    const result = await this.taxEngineService.calculate(dto);
    return this.taxEngineService.saveSnapshot(id, result, '1.0.0');
  }
}
