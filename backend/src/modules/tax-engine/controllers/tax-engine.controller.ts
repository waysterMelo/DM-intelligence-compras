import { Controller, Post, Body, Param, Get, NotFoundException, BadRequestException } from '@nestjs/common';
import { TaxEngineService } from '../services/tax-engine.service';
import { CalculateQuoteTaxDto } from '../dto/calculate-quote-tax.dto';
import { PrismaService } from '../../../prisma.service';

export const TAX_ENGINE_VERSION = '1.0.0';

@Controller('tax')
export class TaxEngineController {
  constructor(
    private readonly taxEngineService: TaxEngineService,
    private readonly prisma: PrismaService
  ) {}

  @Post('calculate-quote')
  async calculateQuote(@Body() dto: CalculateQuoteTaxDto) {
    return this.taxEngineService.calculate(dto);
  }

  @Post('quotes/:id/tax-snapshot')
  async createSnapshot(@Param('id') id: string, @Body() dto: CalculateQuoteTaxDto) {
    const result = await this.taxEngineService.calculate(dto);
    return this.taxEngineService.saveSnapshot(id, result, TAX_ENGINE_VERSION, dto, dto.buyerCompanyId);
  }

  @Get('quotes/:id/tax-snapshots')
  async getSnapshots(@Param('id') id: string) {
    return this.prisma.quoteTaxSnapshot.findMany({
      where: { quoteId: id },
      orderBy: { calculatedAt: 'desc' }
    });
  }

  @Post('quotes/:id/recalculate-tax')
  async recalculateTax(@Param('id') quoteId: string, @Body() body: { buyerCompanyId: string }) {
    if (!body?.buyerCompanyId) throw new BadRequestException("buyerCompanyId is required for recalculation");

    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { requisition: true, fornecedor: true }
    });

    if (!quote || !quote.fornecedorId) throw new NotFoundException('Quote or Supplier not found');

    const dto: CalculateQuoteTaxDto = {
      buyerCompanyId: body.buyerCompanyId,
      supplierCompanyId: quote.fornecedorId,
      item: {
        quantity: quote.requisition.quantity,
        unitPrice: quote.price,
        totalFreight: quote.freight || 0,
        itemUseType: quote.itemUseType as any,
        creditNature: quote.creditNature as any,
        operationType: quote.operationType as any,
        ipiRate: quote.ipiRate || 0,
        icmsRate: quote.icmsRate || 0,
        pisRate: quote.pisRate || 0,
        cofinsRate: quote.cofinsRate || 0,
        hasIcmsSt: quote.hasIcmsSt || false
      }
    };

    const result = await this.taxEngineService.calculate(dto);
    return this.taxEngineService.saveSnapshot(quoteId, result, TAX_ENGINE_VERSION, dto, body.buyerCompanyId);
  }
}
