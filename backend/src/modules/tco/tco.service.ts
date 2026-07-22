import { BadRequestException, Injectable } from '@nestjs/common';
import { ItemUseType } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { calculateInvoiceTco, calculateTco, RecoveryAssumptions, TcoInput } from './tco-calculator';

export type { RecoveryAssumptions, TcoInput } from './tco-calculator';

@Injectable()
export class TcoService {
  constructor(private readonly prisma: PrismaService) {}

  async getAssumptions(itemUseType: ItemUseType | string): Promise<RecoveryAssumptions> {
    const validUses = ['INDUSTRIAL_INPUT', 'CONSUMPTION', 'RESALE', 'FIXED_ASSET'];
    if (!validUses.includes(itemUseType)) throw new BadRequestException('Destinação do item inválida.');
    const buyer = await this.prisma.fornecedor.findFirst({
      where: { companyRole: 'BUYER', isActive: true },
      include: { taxConfig: true },
    });
    if (!buyer) throw new BadRequestException('Empresa compradora não cadastrada.');

    const assumption = await this.prisma.tcoAssumption.findUnique({
      where: { fornecedorId_itemUseType: { fornecedorId: buyer.id, itemUseType: itemUseType as ItemUseType } },
    });
    if (assumption) return {
      icms: assumption.icmsRecoveryPct,
      ipi: assumption.ipiRecoveryPct,
      pis: assumption.pisRecoveryPct,
      cofins: assumption.cofinsRecoveryPct,
    };

    if (itemUseType === 'CONSUMPTION') return { icms: 0, ipi: 0, pis: 0, cofins: 0 };
    return {
      icms: buyer.taxConfig?.icmsCreditPercentage ?? 0,
      ipi: buyer.taxConfig?.ipiCreditPercentage ?? 0,
      pis: buyer.taxConfig?.pisCreditPercentage ?? 0,
      cofins: buyer.taxConfig?.cofinsCreditPercentage ?? 0,
    };
  }

  calculate(input: TcoInput, defaults: RecoveryAssumptions) {
    return calculateTco(input, defaults);
  }

  async preview(input: TcoInput) {
    return calculateTco(input, await this.getAssumptions(input.itemUseType));
  }

  calculateInvoiceEstimate(totals: Parameters<typeof calculateInvoiceTco>[0], assumptions: RecoveryAssumptions) {
    return calculateInvoiceTco(totals, assumptions);
  }
}
