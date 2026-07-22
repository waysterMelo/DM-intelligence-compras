import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemUseType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { TcoService } from '../tco/tco.service';
import { NfeXmlService } from './nfe-xml.service';

@Injectable()
export class RequisitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tcoService: TcoService,
    private readonly nfeXmlService: NfeXmlService,
  ) {}

  private nonNegative(value: unknown, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async findAll() {
    const requisitions = await this.prisma.requisition.findMany({
      include: {
        quotes: { include: { fornecedor: true } },
        purchaseInvoice: true,
      },
      orderBy: { requestDate: 'desc' },
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
    const freight = this.nonNegative(data.freight);
    if (!name || !supplierId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Item, fornecedor e quantidade positiva são obrigatórios.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new BadRequestException('Preço deve ser um valor positivo.');
    }

    const supplier = await this.prisma.fornecedor.findFirst({
      where: { id: supplierId, companyRole: 'SUPPLIER', isActive: true },
    });
    if (!supplier) throw new NotFoundException('Fornecedor ativo não encontrado.');

    const grossTotalCost = this.round(unitPrice * quantity + freight);
    const finalUnitCost = this.round(grossTotalCost / quantity);
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
        costReconciliationStatus: 'PENDING_INVOICE',
        quotes: {
          create: {
            fornecedorId: supplier.id,
            supplierName: supplier.name,
            price: unitPrice,
            freight,
            paymentTerms: String(data.paymentTerms || '').trim(),
            isSelected: true,
            itemUseType: 'CONSUMPTION',
            creditSource: 'SUPPLIER_QUOTE',
            grossTotalCost,
            estimatedCreditTotal: 0,
            estimatedNetTotal: grossTotalCost,
            netCost: finalUnitCost,
            dataCompleteness: 'INCOMPLETE',
            calculationSource: 'SUPPLIER_QUOTE',
            tcoMemory: { purpose: 'QUICK_PURCHASE', missingFields: ['dados tributários da cotação'] },
          },
        },
      },
      include: { quotes: { include: { fornecedor: true } }, purchaseInvoice: true },
    });
  }

  async bulkImportFromText(text: string, department: string) {
    const unitPattern = /^(x|un|unid|pç|pc|cx|caixa|kg|g|gr|mg|lt|l|ml|m|mt|mts|cm|mm|rolo|pct|pacote|saco|lata|par|kit|jogo|fardo|galão|tubo|frasco|balde)$/i;
    const items = text.split('\n').filter(line => line.trim()).map(line => {
      let name = line.trim();
      let quantity = 1;
      let unit = 'un';
      const match = name.match(/^(\d+(?:[.,]\d+)?)\s*([^\s]*)\s*(.*)$/);
      if (match) {
        quantity = Number(match[1].replace(',', '.')) || 1;
        if (unitPattern.test(match[2])) {
          unit = ['x', '*'].includes(match[2].toLowerCase()) ? 'un' : match[2].toLowerCase();
          name = match[3];
        } else {
          name = `${match[2]} ${match[3]}`;
        }
      }
      return {
        name: name.replace(/^(de\s+|-\s+|\.\s+)/i, '').trim() || 'Item sem descrição',
        quantity,
        unit,
        department,
        priority: 'Normal',
        requester: 'Ricardo (WhatsApp)',
        status: 'Solicitado',
      };
    });
    return Promise.all(items.map(item => this.prisma.requisition.create({ data: item })));
  }

  async updateQuotes(id: string, quotes: any[]) {
    const requisition = await this.prisma.requisition.findUnique({ where: { id }, include: { purchaseInvoice: true } });
    if (!requisition) throw new NotFoundException('Requisição não encontrada.');
    if (requisition.purchaseInvoice) throw new ConflictException('A cotação original não pode ser alterada após o recebimento da NF.');
    if (!Array.isArray(quotes) || quotes.length === 0) {
      throw new BadRequestException('Informe ao menos uma cotação.');
    }
    const selectedIndexes = quotes.map((quote, index) => quote.isSelected ? index : -1).filter(index => index >= 0);
    if (selectedIndexes.length > 1) throw new BadRequestException('Apenas um fornecedor pode ser o vencedor.');

    const processedQuotes = await Promise.all(quotes.map(async quote => {
      const companyId = String(quote.companyId || '').trim() || null;
      const supplier = companyId
        ? await this.prisma.fornecedor.findFirst({ where: { id: companyId, companyRole: 'SUPPLIER', isActive: true } })
        : null;
      if (companyId && !supplier) throw new NotFoundException('Fornecedor ativo não encontrado.');
      const itemUseType = (quote.itemUseType || requisition.itemUseType || 'CONSUMPTION') as ItemUseType;
      const input = {
        ...quote,
        companyId: companyId || undefined,
        supplierName: supplier?.name || quote.supplierName,
        itemUseType,
        quantity: requisition.quantity,
        price: this.nonNegative(quote.price),
        freight: this.nonNegative(quote.freight),
      };
      const result = await this.tcoService.preview(input);

      return {
        fornecedorId: companyId,
        supplierName: supplier?.name || String(quote.supplierName || 'Fornecedor não informado'),
        price: input.price,
        freight: input.freight,
        leadTime: Math.floor(this.nonNegative(quote.leadTime)),
        paymentTerms: String(quote.paymentTerms || ''),
        isSelected: Boolean(quote.isSelected),
        itemUseType,
        ncm: String(quote.ncm || '').trim() || null,
        cest: String(quote.cest || '').trim() || null,
        cfop: String(quote.cfop || '').trim() || null,
        cstIcms: String(quote.cstIcms || '').trim() || null,
        csosn: String(quote.csosn || '').trim() || null,
        cstPis: String(quote.cstPis || '').trim() || null,
        cstCofins: String(quote.cstCofins || '').trim() || null,
        hasIcmsSt: Boolean(quote.hasIcmsSt),
        hasFcp: Boolean(quote.hasFcp),
        hasDifal: Boolean(quote.hasDifal),
        icmsRate: this.optionalNumber(quote.icmsRate), icmsValue: this.optionalNumber(quote.icmsValue),
        ipiRate: this.optionalNumber(quote.ipiRate), ipiValue: this.optionalNumber(quote.ipiValue),
        pisRate: this.optionalNumber(quote.pisRate), pisValue: this.optionalNumber(quote.pisValue),
        cofinsRate: this.optionalNumber(quote.cofinsRate), cofinsValue: this.optionalNumber(quote.cofinsValue),
        stRate: this.optionalNumber(quote.stRate), stValue: this.optionalNumber(quote.stValue),
        fcpRate: this.optionalNumber(quote.fcpRate), fcpValue: this.optionalNumber(quote.fcpValue),
        difalRate: this.optionalNumber(quote.difalRate), difalValue: this.optionalNumber(quote.difalValue),
        ipiTreatment: quote.ipiTreatment === 'INCLUDED' ? 'INCLUDED' : 'ADDITIONAL',
        stTreatment: quote.stTreatment === 'INCLUDED' ? 'INCLUDED' : 'ADDITIONAL',
        fcpTreatment: quote.fcpTreatment === 'INCLUDED' ? 'INCLUDED' : 'ADDITIONAL',
        difalTreatment: quote.difalTreatment === 'INCLUDED' ? 'INCLUDED' : 'ADDITIONAL',
        utilizationIcms: result.recovery.icms,
        utilizationIpi: result.recovery.ipi,
        utilizationPis: result.recovery.pis,
        utilizationCofins: result.recovery.cofins,
        creditIcms: result.credits.icms,
        creditIpi: result.credits.ipi,
        creditPis: result.credits.pis,
        creditCofins: result.credits.cofins,
        netCost: result.netCost,
        creditSource: 'SUPPLIER_QUOTE',
        grossTotalCost: result.grossTotalCost,
        estimatedCreditTotal: result.estimatedCreditTotal,
        estimatedNetTotal: result.estimatedNetTotal,
        dataCompleteness: result.dataCompleteness,
        calculationSource: result.calculationSource,
        tcoMemory: result.tcoMemory as Prisma.InputJsonValue,
      };
    }));

    return this.prisma.$transaction(async transaction => {
      await transaction.quote.deleteMany({ where: { requisitionId: id } });
      return transaction.requisition.update({
        where: { id },
        data: {
          itemUseType: processedQuotes[0]?.itemUseType,
          quotes: { create: processedQuotes },
        },
        include: { quotes: { include: { fornecedor: true } }, purchaseInvoice: true },
      });
    });
  }

  private async getInvoiceContext(id: string) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id },
      include: { quotes: { include: { fornecedor: true } }, purchaseInvoice: true },
    });
    if (!requisition) throw new NotFoundException('Requisição não encontrada.');
    if (requisition.purchaseInvoice) throw new ConflictException('Esta requisição já possui uma NF vinculada.');
    const winner = requisition.quotes.find(quote => quote.isSelected) || requisition.quotes.find(quote => quote.fornecedorId);
    if (!winner?.fornecedor) throw new BadRequestException('Defina o fornecedor vencedor antes de registrar a NF.');
    return { requisition, winner };
  }

  private async createInvoice(id: string, data: any, importSource: 'MANUAL' | 'XML') {
    const { requisition, winner } = await this.getInvoiceContext(id);
    const accessKey = String(data.accessKey || '').replace(/\D/g, '');
    const supplierCnpj = String(data.supplierCnpj || '').replace(/\D/g, '');
    const issueDate = new Date(data.issueDate);
    if (!this.nfeXmlService.validateAccessKey(accessKey)) throw new BadRequestException('A chave da NF-e é inválida.');
    if (supplierCnpj !== winner.fornecedor!.cnpj.replace(/\D/g, '')) {
      throw new BadRequestException('O CNPJ da NF-e não corresponde ao fornecedor vencedor.');
    }
    if (!String(data.number || '').trim() || Number.isNaN(issueDate.getTime())) {
      throw new BadRequestException('Número e data de emissão da NF são obrigatórios.');
    }
    const grossTotal = this.nonNegative(data.grossTotal);
    if (grossTotal <= 0) throw new BadRequestException('O total da NF deve ser maior que zero.');

    const totals = {
      grossTotal,
      icmsTotal: this.nonNegative(data.icmsTotal),
      ipiTotal: this.nonNegative(data.ipiTotal),
      pisTotal: this.nonNegative(data.pisTotal),
      cofinsTotal: this.nonNegative(data.cofinsTotal),
    };
    const assumptions = await this.tcoService.getAssumptions(requisition.itemUseType);
    const actual = this.tcoService.calculateInvoiceEstimate(totals, assumptions);
    const quotedGrossTotal = winner.grossTotalCost ?? this.round(winner.price * requisition.quantity + (winner.freight || 0));
    const quotedNetEstimatedTotal = winner.estimatedNetTotal ?? quotedGrossTotal;
    const quotedFreightTotal = winner.freight || 0;
    const memory = (winner.tcoMemory || {}) as Record<string, any>;
    const resolved = memory.resolvedTaxes || {};
    const quotedTaxTotal = this.round(['icms', 'ipi', 'pis', 'cofins', 'st', 'fcp', 'difal']
      .reduce((sum, tax) => sum + this.nonNegative(resolved[tax]?.amount), 0) * requisition.quantity);
    const actualTaxTotal = this.round(
      totals.icmsTotal + totals.ipiTotal + totals.pisTotal + totals.cofinsTotal +
      this.nonNegative(data.stTotal) + this.nonNegative(data.fcpTotal) + this.nonNegative(data.difalTotal),
    );
    const freightVariance = this.round(this.nonNegative(data.freightTotal) - quotedFreightTotal);
    const taxVariance = this.round(actualTaxTotal - quotedTaxTotal);
    const grossVariance = this.round(grossTotal - quotedGrossTotal);
    const netVariance = this.round(actual.actualNetEstimatedTotal - quotedNetEstimatedTotal);
    const hasDivergence = Math.abs(grossVariance) > 0.01 || Math.abs(netVariance) > 0.01;

    try {
      return await this.prisma.$transaction(async transaction => {
        const invoice = await transaction.purchaseInvoice.create({
          data: {
            requisitionId: id,
            number: String(data.number).trim(),
            series: String(data.series || '').trim() || null,
            accessKey,
            issueDate,
            supplierCnpj,
            importSource,
            productTotal: this.nonNegative(data.productTotal),
            freightTotal: this.nonNegative(data.freightTotal),
            discountTotal: this.nonNegative(data.discountTotal),
            grossTotal,
            icmsTotal: totals.icmsTotal,
            ipiTotal: totals.ipiTotal,
            pisTotal: totals.pisTotal,
            cofinsTotal: totals.cofinsTotal,
            stTotal: this.nonNegative(data.stTotal),
            fcpTotal: this.nonNegative(data.fcpTotal),
            difalTotal: this.nonNegative(data.difalTotal),
            cbsTotal: this.nonNegative(data.cbsTotal),
            ibsTotal: this.nonNegative(data.ibsTotal),
            estimatedRecoverableTotal: actual.estimatedRecoverableTotal,
            actualNetEstimatedTotal: actual.actualNetEstimatedTotal,
            quotedGrossTotal,
            quotedNetEstimatedTotal,
            quotedFreightTotal,
            quotedTaxTotal,
            actualTaxTotal,
            freightVariance,
            taxVariance,
            grossVariance,
            netVariance,
            xmlContent: data.xmlContent || null,
          },
        });
        await transaction.requisition.update({
          where: { id },
          data: {
            costReconciliationStatus: hasDivergence ? 'DIVERGENCE_FOUND' : 'INVOICE_RECEIVED',
          },
        });
        return invoice;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Esta chave de NF-e já foi importada.');
      }
      throw error;
    }
  }

  createManualInvoice(id: string, data: any) {
    return this.createInvoice(id, data, 'MANUAL');
  }

  createXmlInvoice(id: string, file: any) {
    if (!file?.buffer) throw new BadRequestException('Selecione o arquivo XML da NF-e.');
    const parsed = this.nfeXmlService.parse(file.buffer);
    return this.createInvoice(id, parsed, 'XML');
  }

  async reconcileInvoice(id: string, data: { acceptDivergence?: boolean }) {
    const requisition = await this.prisma.requisition.findUnique({
      where: { id }, include: { purchaseInvoice: true },
    });
    if (!requisition?.purchaseInvoice) throw new NotFoundException('NF não encontrada para esta requisição.');
    const diverged = Math.abs(requisition.purchaseInvoice.grossVariance) > 0.01 ||
      Math.abs(requisition.purchaseInvoice.netVariance) > 0.01;
    if (diverged && data.acceptDivergence !== true) {
      throw new BadRequestException('Confirme explicitamente que a divergência comercial foi aceita.');
    }
    return this.prisma.requisition.update({
      where: { id },
      data: { costReconciliationStatus: 'COST_CONFIRMED', costReconciledAt: new Date() },
      include: { purchaseInvoice: true, quotes: { include: { fornecedor: true } } },
    });
  }

  async updateStatus(id: string, data: { status: string; finalCost?: number; paymentTerms?: string }) {
    return this.prisma.requisition.update({
      where: { id },
      data: {
        status: data.status,
        finalCost: data.finalCost,
        paymentTerms: data.paymentTerms,
        deliveryDate: data.status === 'Entregue' ? new Date() : undefined,
        costReconciliationStatus: data.status === 'Comprado' ? 'PENDING_INVOICE' : undefined,
      },
    });
  }

  delete(id: string) {
    return this.prisma.requisition.delete({ where: { id } });
  }
}
