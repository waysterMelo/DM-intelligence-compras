import { Injectable } from '@nestjs/common';
import { CalculateQuoteTaxDto } from '../dto/calculate-quote-tax.dto';
import { TaxCalculationResultDto } from '../dto/tax-calculation-result.dto';
import { GrossCostCalculator } from './calculators/gross-cost.calculator';
import { IcmsCalculator } from './calculators/icms.calculator';
import { PisCalculator } from './calculators/pis.calculator';
import { CofinsCalculator } from './calculators/cofins.calculator';
import { IpiCalculator } from './calculators/ipi.calculator';
import { TaxMemoryMapper } from './mappers/tax-memory.mapper';
import { PrismaService } from '../../../prisma.service'; 

@Injectable()
export class TaxEngineService {
  constructor(
    private readonly grossCostCalculator: GrossCostCalculator,
    private readonly icmsCalculator: IcmsCalculator,
    private readonly pisCalculator: PisCalculator,
    private readonly cofinsCalculator: CofinsCalculator,
    private readonly ipiCalculator: IpiCalculator,
    private readonly taxMemoryMapper: TaxMemoryMapper,
    private readonly prisma: PrismaService 
  ) {}

  async calculate(dto: CalculateQuoteTaxDto): Promise<TaxCalculationResultDto> {
    const ctx = await this.buildContext(dto);

    const gross = this.grossCostCalculator.calculate(ctx);
    const icms = this.icmsCalculator.calculate(ctx);
    const pis = this.pisCalculator.calculate(ctx);
    const cofins = this.cofinsCalculator.calculate(ctx);
    const ipi = this.ipiCalculator.calculate(ctx);

    const totalCredits =
      icms.creditAmount +
      pis.creditAmount +
      cofins.creditAmount +
      ipi.creditAmount;

    const grossCostTotal = gross.grossCostTotal;
    const netCostTotal = grossCostTotal - totalCredits;
    const netCostUnit = netCostTotal / ctx.item.quantity;

    const result = {
      grossCostUnit: gross.grossCostUnit,
      grossCostTotal,
      netCostUnit,
      netCostTotal,
      credits: {
        icms: icms.creditAmount,
        pis: pis.creditAmount,
        cofins: cofins.creditAmount,
        ipi: ipi.creditAmount,
      },
      disallowedCredits: {
        icms: icms.disallowedReasons.length ? icms.disallowedReasons : undefined,
        pis: pis.disallowedReasons.length ? pis.disallowedReasons : undefined,
        cofins: cofins.disallowedReasons.length ? cofins.disallowedReasons : undefined,
        ipi: ipi.disallowedReasons.length ? ipi.disallowedReasons : undefined,
      },
      legalBasis: [
        ...icms.legalBasis,
        ...pis.legalBasis,
        ...cofins.legalBasis,
        ...ipi.legalBasis,
      ],
      memory: this.taxMemoryMapper.build(ctx, gross, [icms, pis, cofins, ipi]),
    };

    return result as any;
  }

  private async buildContext(dto: CalculateQuoteTaxDto): Promise<any> {
    const buyer = await this.prisma.fornecedor.findUnique({
      where: { id: dto.buyerCompanyId }
    });
    
    const supplier = await this.prisma.fornecedor.findUnique({
      where: { id: dto.supplierCompanyId }
    });

    if (!buyer || !supplier) {
       throw new Error('Comprador ou Fornecedor não encontrados');
    }

    return {
      buyer: {
        id: buyer.id,
        regime: buyer.taxRegime,
        pisCofinsRegime: (buyer as any).pisCofinsRegime || 'CUMULATIVE',
        isIcmsTaxpayer: (buyer as any).isIcmsTaxpayer || false,
        isIpiTaxpayer: (buyer as any).isIpiTaxpayer || false,
        state: (buyer as any).state || 'SP'
      },
      supplier: {
        id: supplier.id,
        regime: supplier.taxRegime,
        state: (supplier as any).state || 'SP'
      },
      item: dto.item
    };
  }

  async saveSnapshot(quoteId: string, result: TaxCalculationResultDto, version: string) {
    return this.prisma.quoteTaxSnapshot.create({
      data: {
        quoteId,
        engineVersion: version,
        grossCostUnit: result.grossCostUnit,
        grossCostTotal: result.grossCostTotal,
        netCostUnit: result.netCostUnit,
        netCostTotal: result.netCostTotal,
        icmsCredit: result.credits.icms,
        pisCredit: result.credits.pis,
        cofinsCredit: result.credits.cofins,
        ipiCredit: result.credits.ipi,
        legalBasisJson: result.legalBasis || [],
        disallowedCreditsJson: result.disallowedCredits || {},
        memoryJson: result.memory || {}
      }
    });
  }
}
