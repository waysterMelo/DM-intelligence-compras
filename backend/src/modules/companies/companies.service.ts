import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ItemUseType, Prisma } from '@prisma/client';

// O CompaniesService é responsável pela gestão de Fornecedores e da Compradora (RA Polymers)
// É aqui que guardamos o "DNA Fiscal" de cada parceiro de negócio

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  // Cria uma nova empresa (Fornecedor ou Comprador)
  async create(data: { 
    name: string; 
    cnpj: string; 
    taxRegime: string; 
    companyRole: string 
  }) {
    const normalizedCnpj = data.cnpj?.replace(/\D/g, '');
    if (!normalizedCnpj || normalizedCnpj.length !== 14) {
      throw new BadRequestException('CNPJ inválido. Informe 14 dígitos.');
    }

    try {
      return await this.prisma.fornecedor.create({
        data: {
          ...data,
          cnpj: normalizedCnpj,
          taxRegime: data.taxRegime?.toUpperCase(),
          companyRole: data.companyRole?.toUpperCase(),
          isActive: true
        }
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('CNPJ já cadastrado.');
      }
      throw error;
    }
  }

  // Lista todas as empresas cadastradas
  async findAll() {
    return this.prisma.fornecedor.findMany({
      orderBy: { name: 'asc' }
    });
  }

  // Busca apenas os Fornecedores (útil para preencher o TCO)
  async findSuppliers() {
    return this.prisma.fornecedor.findMany({
      where: { companyRole: 'SUPPLIER', isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  // Busca a empresa compradora (RA Polymers) para saber o regime dela
  async findBuyer() {
    return this.prisma.fornecedor.findFirst({
      where: { companyRole: 'BUYER', isActive: true },
      include: { taxConfig: true }
    });
  }

  // Busca apenas a configuração fiscal do comprador
  async getTaxConfig() {
    const buyer = await this.findBuyer();
    if (!buyer) throw new BadRequestException('Empresa compradora não cadastrada.');
    
    const existing = await this.prisma.taxConfiguration.findUnique({
      where: { fornecedorId: buyer.id }
    });
    return existing ?? this.prisma.taxConfiguration.create({
      data: { fornecedorId: buyer.id }
    });
  }

  // Atualiza ou cria as porcentagens de aproveitamento
  async updateTaxConfig(data: {
    icmsCreditPercentage?: number;
    pisCreditPercentage?: number;
    cofinsCreditPercentage?: number;
    ipiCreditPercentage?: number;
  }) {
    const buyer = await this.findBuyer();
    if (!buyer) throw new BadRequestException('Empresa compradora não cadastrada.');

    const allowedKeys = [
      'icmsCreditPercentage', 'pisCreditPercentage',
      'cofinsCreditPercentage', 'ipiCreditPercentage',
    ] as const;
    const sanitized = Object.fromEntries(allowedKeys
      .filter(key => data[key] !== undefined)
      .map(key => {
        const value = Number(data[key]);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          throw new BadRequestException(`${key} deve estar entre 0 e 100.`);
        }
        return [key, value];
      }));

    return this.prisma.taxConfiguration.upsert({
      where: { fornecedorId: buyer.id },
      update: sanitized,
      create: { ...sanitized, fornecedorId: buyer.id }
    });
  }

  async getTcoAssumptions() {
    const buyer = await this.findBuyer();
    if (!buyer) throw new BadRequestException('Empresa compradora não cadastrada.');
    const existing = await this.prisma.tcoAssumption.findMany({
      where: { fornecedorId: buyer.id },
      orderBy: { itemUseType: 'asc' },
    });
    if (existing.length === 4) return existing;

    const legacy = await this.getTaxConfig();
    const uses: ItemUseType[] = ['INDUSTRIAL_INPUT', 'RESALE', 'FIXED_ASSET', 'CONSUMPTION'];
    await Promise.all(uses.map(itemUseType => {
      const zero = itemUseType === 'CONSUMPTION';
      return this.prisma.tcoAssumption.upsert({
        where: { fornecedorId_itemUseType: { fornecedorId: buyer.id, itemUseType } },
        update: {},
        create: {
          fornecedorId: buyer.id,
          itemUseType,
          icmsRecoveryPct: zero ? 0 : legacy.icmsCreditPercentage,
          ipiRecoveryPct: zero ? 0 : legacy.ipiCreditPercentage,
          pisRecoveryPct: zero ? 0 : legacy.pisCreditPercentage,
          cofinsRecoveryPct: zero ? 0 : legacy.cofinsCreditPercentage,
        },
      });
    }));
    return this.prisma.tcoAssumption.findMany({
      where: { fornecedorId: buyer.id },
      orderBy: { itemUseType: 'asc' },
    });
  }

  async updateTcoAssumptions(rows: any[]) {
    const buyer = await this.findBuyer();
    if (!buyer) throw new BadRequestException('Empresa compradora não cadastrada.');
    if (!Array.isArray(rows)) throw new BadRequestException('Informe a matriz de premissas de TCO.');
    const validUses: ItemUseType[] = ['INDUSTRIAL_INPUT', 'RESALE', 'FIXED_ASSET', 'CONSUMPTION'];
    const keys = ['icmsRecoveryPct', 'ipiRecoveryPct', 'pisRecoveryPct', 'cofinsRecoveryPct'] as const;

    const sanitized = rows.map(row => {
      if (!validUses.includes(row.itemUseType)) throw new BadRequestException('Destinação inválida.');
      const values = Object.fromEntries(keys.map(key => {
        const value = Number(row[key]);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          throw new BadRequestException(`${key} deve estar entre 0 e 100.`);
        }
        return [key, value];
      }));
      return { itemUseType: row.itemUseType as ItemUseType, ...values };
    });

    await this.prisma.$transaction(sanitized.map(row => this.prisma.tcoAssumption.upsert({
      where: { fornecedorId_itemUseType: { fornecedorId: buyer.id, itemUseType: row.itemUseType } },
      update: row,
      create: { ...row, fornecedorId: buyer.id },
    })));
    return this.getTcoAssumptions();
  }

  // Atualiza dados de uma empresa
  async update(id: string, data: any) {
    return this.prisma.fornecedor.update({
      where: { id },
      data
    });
  }

  // Remove uma empresa (Soft delete ou Hard delete)
  async remove(id: string) {
    return this.prisma.fornecedor.delete({
      where: { id }
    });
  }
}
