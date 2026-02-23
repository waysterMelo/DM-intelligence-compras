import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TaxCreditService, TaxContext } from '../tax-engine/tax-credit.service';
import { CompaniesService } from '../companies/companies.service';

@Injectable()
export class RequisitionsService {
  constructor(
    private prisma: PrismaService,
    private taxCreditService: TaxCreditService,
    private companiesService: CompaniesService
  ) {}

  // Busca todas as requisições ordenadas por data
  async findAll() {
    return this.prisma.requisition.findMany({
      include: { quotes: { include: { fornecedor: true } } },
      orderBy: { requestDate: 'desc' }
    });
  }

  // Lógica de "Captura Inteligente" (Bulk Import)
  async bulkImportFromText(text: string, department: string) {
    const lines = text.split('\n').filter(line => line.trim());
    const unitPattern = /^(x|un|unid|pç|pc|cx|caixa|kg|kilo|g|gr|mg|lt|l|ml|m|mt|mts|cm|mm|rolo|pct|pacote|saco|saca|lata|par|kit|jogo|sc|br|fardo|galão|gl|vidro|bisnaga|tb|tubo|fr|frasco|bd|balde)$/i;

    const newItems = lines.map(line => {
      let name = line.trim();
      let quantity = 1;
      let unit = 'un';

      const qtyMatch = name.match(/^(\d+)(.*)$/);
      if (qtyMatch) {
          quantity = parseInt(qtyMatch[1], 10);
          const rest = qtyMatch[2].trim();
          const firstWordMatch = rest.match(/^([a-zA-ZçÇãõÃÕáéíóúÁÉÍÓÚ]+|[xX*])\.?(\s+(.*))?$/);
          if (firstWordMatch) {
              const potentialUnit = firstWordMatch[1];
              if (unitPattern.test(potentialUnit)) {
                  unit = ['x', 'X', '*'].includes(potentialUnit) ? 'un' : potentialUnit.toLowerCase();
                  name = (firstWordMatch[3] || "").trim();
              } else {
                  name = rest;
              }
          } else {
              name = rest;
          }
      }
      
      name = name.replace(/^(de\s+|-\s+|\.\s+)/i, '').trim() || "Item sem descrição";

      return {
        name,
        quantity,
        unit,
        department,
        priority: 'Normal',
        requester: 'Ricardo (WhatsApp)',
        status: 'Solicitado',
      };
    });

    return Promise.all(newItems.map(item => this.prisma.requisition.create({ data: item })));
  }

  // Atualiza o Mapa de Cotação da Requisição com Inteligência Fiscal (Motor de Créditos)
  async updateQuotes(id: string, quotes: any[]) {
    // 1. Busca o Comprador (RA Polymers) para saber o regime fiscal
    const buyer = await this.companiesService.findBuyer();
    const requisition = await this.prisma.requisition.findUnique({ where: { id } });

    if (!buyer || !requisition) {
      throw new Error("Comprador ou Requisição não encontrados");
    }

    // 2. Apaga as cotações existentes desta requisição
    await this.prisma.quote.deleteMany({ where: { requisitionId: id } });

    // 3. Processa cada cotação usando o Motor de Créditos
    const processedQuotes = await Promise.all(quotes.map(async (q) => {
      if (!q.companyId) {
        return {
          supplierName: q.supplierName || 'Fornecedor avulso',
          price: q.price || 0,
          freight: q.freight || 0,
          isSelected: q.isSelected
        };
      }

      const supplier = await this.prisma.fornecedor.findUnique({ where: { id: q.companyId } });
      if (!supplier) throw new Error("Fornecedor não encontrado");

      const taxCtx: TaxContext = {
        buyerRegime: buyer.taxRegime,
        supplierRegime: supplier.taxRegime,
        itemUseType: q.itemUseType || 'INDUSTRIAL_INPUT',
        price: q.price || 0,
        quantity: requisition.quantity || 1,
        freight: q.freight || 0,
        ipiRate: q.ipiRate || 0,
        icmsRate: q.icmsRate || 0,
        pisRate: q.pisRate || 0,
        cofinsRate: q.cofinsRate || 0
      };

      const taxResult = this.taxCreditService.calculate(taxCtx);

      return {
        fornecedorId: q.companyId,
        supplierName: supplier.name,
        price: q.price || 0,
        freight: q.freight || 0,
        leadTime: q.leadTime || 0,
        paymentTerms: q.paymentTerms || '',
        itemUseType: q.itemUseType || 'INDUSTRIAL_INPUT',
        ipiRate: q.ipiRate || 0,
        icmsRate: q.icmsRate || 0,
        pisRate: q.pisRate || 0,
        cofinsRate: q.cofinsRate || 0,
        // Resultados do Motor Fiscal
        creditIcms: taxResult.creditIcms,
        creditPis: taxResult.creditPis,
        creditCofins: taxResult.creditCofins,
        netCost: taxResult.netCost,
        taxMemory: taxResult.taxMemory as any,
        isSelected: q.isSelected
      };
    }));

    // 4. Salva no banco
    return this.prisma.requisition.update({
      where: { id },
      data: {
        quotes: {
          create: processedQuotes
        }
      },
      include: { quotes: { include: { fornecedor: true } } }
    });
  }

  async updateStatus(id: string, data: { status: string; finalCost?: number; paymentTerms?: string }) {
    return this.prisma.requisition.update({
      where: { id },
      data: {
        status: data.status,
        finalCost: data.finalCost,
        paymentTerms: data.paymentTerms,
        deliveryDate: data.status === 'Entregue' ? new Date() : undefined
      }
    });
  }

  async delete(id: string) {
    return this.prisma.requisition.delete({ where: { id } });
  }
}
