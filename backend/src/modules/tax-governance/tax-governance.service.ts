import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TaxGovernanceService {
  constructor(private prisma: PrismaService) {}

  async findAllRules() {
    return this.prisma.taxRuleCatalog.findMany({
      orderBy: { code: 'asc' }
    });
  }

  async compareSnapshots(idA: string, idB: string) {
    const snapA = await this.prisma.quoteTaxSnapshot.findUnique({ where: { id: idA } });
    const snapB = await this.prisma.quoteTaxSnapshot.findUnique({ where: { id: idB } });

    if (!snapA || !snapB) {
      throw new NotFoundException('Um ou ambos os Snapshots não foram encontrados.');
    }

    const inputHashChanged = snapA.inputHash !== snapB.inputHash;
    const outputChanged = snapA.netCostTotal !== snapB.netCostTotal || snapA.icmsCredit !== snapB.icmsCredit; // Exemplo de hash indireto visual

    return {
      metadata: {
        snapshotA: snapA.id,
        snapshotB: snapB.id,
        algorithm: snapA.hashAlgorithm,
        inputHashChanged,
        outputChanged
      },
      compare: {
        grossCostTotal: { from: snapA.grossCostTotal, to: snapB.grossCostTotal, diff: snapB.grossCostTotal - snapA.grossCostTotal },
        netCostTotal: { from: snapA.netCostTotal, to: snapB.netCostTotal, diff: snapB.netCostTotal - snapA.netCostTotal },
        credits: {
          icms: { from: snapA.icmsCredit, to: snapB.icmsCredit, diff: snapB.icmsCredit - snapA.icmsCredit },
          pis: { from: snapA.pisCredit, to: snapB.pisCredit, diff: snapB.pisCredit - snapA.pisCredit },
          cofins: { from: snapA.cofinsCredit, to: snapB.cofinsCredit, diff: snapB.cofinsCredit - snapA.cofinsCredit },
          ipi: { from: snapA.ipiCredit, to: snapB.ipiCredit, diff: snapB.ipiCredit - snapA.ipiCredit },
        },
        ruleCodes: {
          from: snapA.ruleCodesJson,
          to: snapB.ruleCodesJson
        },
        legalBasis: {
          from: snapA.legalBasisJson,
          to: snapB.legalBasisJson
        },
        confidenceLevel: {
          from: snapA.confidenceLevel,
          to: snapB.confidenceLevel
        },
        calculationStatus: {
          from: snapA.calculationStatus,
          to: snapB.calculationStatus
        }
      }
    };
  }
}
