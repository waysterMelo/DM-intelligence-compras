import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TaxCreditService, TaxContext } from '../tax-engine/tax-credit.service';
import { ItemUseType } from '@prisma/client';

@Injectable()
export class RequisitionsService {
  constructor(
    private prisma: PrismaService,
    private taxCreditService: TaxCreditService
  ) {}

  // Busca todas as requisições ordenadas por data
  async findAll() {
    const requisitions = await this.prisma.requisition.findMany({
      include: { quotes: { include: { fornecedor: true } } },
      orderBy: { requestDate: 'desc' }
    });

    return requisitions.map(requisition => ({
      ...requisition,
      quotes: requisition.quotes.map(quote => ({
        ...quote,
        companyId: quote.fornecedorId,
        company: quote.fornecedor,
      })),
    }));
  }

  async createQuickPurchase(data: any) {
    const name = String(data.name || '').trim();
    const supplierId = String(data.supplierId || '').trim();
    const quantity = Number(data.quantity);
    const unitPrice = Number(data.unitPrice);
    const freight = Number(data.freight || 0);

    if (!name || !supplierId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Item, fornecedor e quantidade positiva são obrigatórios.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(freight) || freight < 0) {
      throw new BadRequestException('Preço e frete devem ser valores positivos.');
    }

    const supplier = await this.prisma.fornecedor.findFirst({
      where: { id: supplierId, companyRole: 'SUPPLIER', isActive: true },
    });
    if (!supplier) throw new NotFoundException('Fornecedor ativo não encontrado.');

    // finalCost é unitário em todo o sistema; o frete total é rateado para que
    // dashboards não multipliquem um total de pedido pela quantidade novamente.
    const finalUnitCost = unitPrice + (freight / quantity);
    return this.prisma.requisition.create({
      data: {
        name,
        quantity,
        unit: String(data.unit || 'un').trim() || 'un',
        estimatedCost: finalUnitCost,
        finalCost: finalUnitCost,
        paymentTerms: String(data.paymentTerms || '').trim() || null,
        department: String(data.department || 'Produção'),
        priority: 'Normal',
        requester: String(data.requester || '').trim() || 'Compras',
        notes: String(data.notes || '').trim() || null,
        status: 'Comprado',
        purchaseMode: 'QUICK',
        taxStatus: 'PENDING_INVOICE',
        quotes: {
          create: {
            fornecedorId: supplier.id,
            supplierName: supplier.name,
            price: unitPrice,
            freight,
            paymentTerms: String(data.paymentTerms || '').trim(),
            isSelected: true,
            itemUseType: 'CONSUMPTION',
            creditSource: 'PENDING_INVOICE',
            netCost: null,
          },
        },
      },
      include: { quotes: { include: { fornecedor: true } } },
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
    const buyer = await this.prisma.fornecedor.findFirst({
      where: { companyRole: 'BUYER' },
      include: { taxConfig: true },
    });
    const requisition = await this.prisma.requisition.findUnique({ where: { id } });
    if (!buyer || !requisition) {
      throw new NotFoundException('Comprador ou requisição não encontrados.');
    }

    const utilizationConfig = {
      icms: buyer.taxConfig?.icmsCreditPercentage ?? 100,
      pis: buyer.taxConfig?.pisCreditPercentage ?? 100,
      cofins: buyer.taxConfig?.cofinsCreditPercentage ?? 100,
      ipi: buyer.taxConfig?.ipiCreditPercentage ?? 100,
    };

    // Calcula e valida antes de apagar. Uma cotação inválida não pode destruir
    // o mapa de fornecedores que já estava persistido.
    const processedQuotes = await Promise.all(quotes.map(async q => {
      const currentItemUseType = q.itemUseType || requisition.itemUseType || 'CONSUMPTION';
      const common = {
        supplierName: q.supplierName || 'Fornecedor avulso',
        price: Math.max(0, Number(q.price) || 0),
        freight: Math.max(0, Number(q.freight) || 0),
        leadTime: Math.max(0, Number(q.leadTime) || 0),
        paymentTerms: q.paymentTerms || '',
        isSelected: Boolean(q.isSelected),
        itemUseType: currentItemUseType as ItemUseType,
        ipiRate: q.ipiRate || 0,
        ipiValue: q.ipiValue,
        icmsRate: q.icmsRate || 0,
        icmsValue: q.icmsValue,
        pisRate: q.pisRate || 0,
        pisValue: q.pisValue,
        cofinsRate: q.cofinsRate || 0,
        cofinsValue: q.cofinsValue,
        cbsRate: q.cbsRate || 0,
        cbsValue: q.cbsValue || 0,
        ibsRate: q.ibsRate || 0,
        ibsValue: q.ibsValue || 0,
        cstIcms: q.cstIcms,
        csosn: q.csosn,
        cstPis: q.cstPis,
        cstCofins: q.cstCofins,
        cstIbsCbs: q.cstIbsCbs,
        taxClassCode: q.taxClassCode,
      };

      if (!q.companyId) {
        return {
          ...common,
          creditSource: q.creditSource || 'MANUAL',
          netCost: common.price + (common.freight / (requisition.quantity || 1)) + (common.ipiValue ?? common.price * (common.ipiRate / 100)),
        };
      }

      const supplier = await this.prisma.fornecedor.findUnique({ where: { id: q.companyId } });
      if (!supplier) throw new NotFoundException('Fornecedor não encontrado.');

      const hasManualUtilization = !['NF', 'PENDING_INVOICE'].includes(q.creditSource) &&
        [q.utilizationIcms, q.utilizationPis, q.utilizationCofins, q.utilizationIpi]
          .some(value => value !== undefined && value !== null);
      const manualUtilization = hasManualUtilization ? {
        icms: q.utilizationIcms,
        pis: q.utilizationPis,
        cofins: q.utilizationCofins,
        ipi: q.utilizationIpi,
      } : undefined;

      const taxCtx: TaxContext = {
        buyerRegime: buyer.taxRegime,
        supplierRegime: supplier.taxRegime,
        itemUseType: currentItemUseType,
        price: common.price,
        quantity: requisition.quantity || 1,
        freight: common.freight,
        ipiRate: common.ipiRate,
        ipiValue: common.ipiValue,
        icmsRate: common.icmsRate,
        icmsValue: common.icmsValue,
        pisRate: common.pisRate,
        pisValue: common.pisValue,
        cofinsRate: common.cofinsRate,
        cofinsValue: common.cofinsValue,
        cbsRate: common.cbsRate,
        cbsValue: common.cbsValue,
        ibsRate: common.ibsRate,
        ibsValue: common.ibsValue,
        cstIcms: common.cstIcms,
        csosn: common.csosn,
        cstPis: common.cstPis,
        cstCofins: common.cstCofins,
        manualUtilization,
        utilizationConfig,
      };
      const taxResult = this.taxCreditService.calculate(taxCtx);

      return {
        ...common,
        fornecedorId: supplier.id,
        supplierName: supplier.name,
        utilizationIcms: manualUtilization?.icms ?? taxResult.taxMemory.finalUtilization.icms,
        utilizationPis: manualUtilization?.pis ?? taxResult.taxMemory.finalUtilization.pis,
        utilizationCofins: manualUtilization?.cofins ?? taxResult.taxMemory.finalUtilization.cofins,
        utilizationIpi: manualUtilization?.ipi ?? taxResult.taxMemory.finalUtilization.ipi,
        creditIcms: taxResult.creditIcms,
        creditPis: taxResult.creditPis,
        creditCofins: taxResult.creditCofins,
        creditIpi: taxResult.creditIpi,
        netCost: taxResult.netCost,
        creditSource: q.creditSource || 'NF',
        taxMemory: taxResult.taxMemory as any,
      };
    }));

    return this.prisma.$transaction(async tx => {
      await tx.quote.deleteMany({ where: { requisitionId: id } });
      return tx.requisition.update({
        where: { id },
        data: {
          itemUseType: processedQuotes[0]?.itemUseType,
          quotes: { create: processedQuotes },
        },
        include: { quotes: { include: { fornecedor: true } } },
      });
    });
  }

  async finalizeQuickPurchaseTax(id: string, data: any) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
      include: { quotes: true },
    });
    if (!requisition || requisition.purchaseMode !== 'QUICK') {
      throw new NotFoundException('Compra rápida não encontrada.');
    }

    const invoiceNumber = String(data.invoiceNumber || '').trim();
    const invoiceAccessKey = String(data.invoiceAccessKey || '').replace(/\D/g, '');
    const invoiceIssueDate = new Date(data.invoiceIssueDate);
    if (!invoiceNumber || Number.isNaN(invoiceIssueDate.getTime())) {
      throw new BadRequestException('Número e data de emissão da nota são obrigatórios.');
    }
    if (invoiceAccessKey && invoiceAccessKey.length !== 44) {
      throw new BadRequestException('A chave de acesso da NF-e deve ter 44 dígitos.');
    }

    const originalQuote = requisition.quotes.find(quote => quote.isSelected) || requisition.quotes[0];
    if (!originalQuote?.fornecedorId) {
      throw new BadRequestException('A compra não possui fornecedor cadastrado.');
    }
    await this.updateQuotes(id, [{
      ...originalQuote,
      ...data.quote,
      companyId: originalQuote.fornecedorId,
      supplierName: originalQuote.supplierName,
      price: originalQuote.price,
      freight: originalQuote.freight,
      paymentTerms: originalQuote.paymentTerms,
      isSelected: true,
      creditSource: 'NF',
    }]);

    return this.prisma.requisition.update({
      where: { id },
      data: {
        taxStatus: 'CALCULATED',
        invoiceNumber,
        invoiceAccessKey: invoiceAccessKey || null,
        invoiceIssueDate,
        taxReviewedAt: new Date(),
      },
      include: { quotes: { include: { fornecedor: true } } },
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
