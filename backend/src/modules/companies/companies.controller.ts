import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // Rota POST /companies -> Cadastra uma nova empresa (Fornecedor ou Compradora)
  @Post()
  async create(@Body() data: any) {
    return this.companiesService.create(data);
  }

  // Rota GET /companies -> Lista todas as empresas
  @Get()
  async getAll() {
    return this.companiesService.findAll();
  }

  // Rota GET /companies/suppliers -> Lista apenas fornecedores (para preencher o TCO)
  @Get('suppliers')
  async getSuppliers() {
    return this.companiesService.findSuppliers();
  }

  // Rota GET /companies/buyer -> Busca a RA Polymers (Compradora)
  @Get('buyer')
  async getBuyer() {
    return this.companiesService.findBuyer();
  }

  // Rota PATCH /companies/:id -> Atualiza dados da empresa
  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.companiesService.update(id, data);
  }

  // Rota DELETE /companies/:id -> Remove a empresa
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
