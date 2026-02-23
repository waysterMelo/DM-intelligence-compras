import { Controller, Get, Post, Patch, Put, Delete, Body, Param } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';

// O Controller define as URLs (Rotas) que o seu Frontend poderá chamar
// Este controller responderá por http://localhost:3000/requisitions

@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  // Rota GET /requisitions -> Lista todas as requisições
  @Get()
  async getAll() {
    return this.requisitionsService.findAll();
  }

  // Rota POST /requisitions/bulk-import -> Recebe texto do WhatsApp para importação
  @Post('bulk-import')
  async bulkImport(@Body() data: { text: string; department: string }) {
    return this.requisitionsService.bulkImportFromText(data.text, data.department);
  }

  // Rota PATCH /requisitions/:id/status -> Atualiza status e custo final
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() data: { status: string; finalCost?: number; paymentTerms?: string }
  ) {
    return this.requisitionsService.updateStatus(id, data);
  }

  // Rota PUT /requisitions/:id/quotes -> Atualiza o mapa de cotação
  @Put(':id/quotes')
  async updateQuotes(@Param('id') id: string, @Body() quotes: any[]) {
    return this.requisitionsService.updateQuotes(id, quotes);
  }

  // Rota DELETE /requisitions/:id -> Remove a requisição
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.requisitionsService.delete(id);
  }
}
