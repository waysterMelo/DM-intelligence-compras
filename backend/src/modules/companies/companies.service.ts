import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

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
    return this.prisma.fornecedor.create({
      data: {
        ...data,
        isActive: true
      }
    });
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
      where: { companyRole: 'BUYER', isActive: true }
    });
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
