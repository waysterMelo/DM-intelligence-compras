import { Injectable } from '@nestjs/common';

export interface TaxContext {
  buyerRegime: string;     // REAL | PRESUMIDO | SIMPLES
  supplierRegime: string;  // REAL | PRESUMIDO | SIMPLES
  itemUseType: string;     // INDUSTRIAL_INPUT | RESALE | CONSUMPTION | FIXED_ASSET
  price: number;           // Preço Unitário Base
  quantity: number;
  freight: number;         // Frete Total
  ipiRate: number;
  icmsRate: number;
  pisRate: number;
  cofinsRate: number;
  ipiValue?: number;
  icmsValue?: number;
  pisValue?: number;
  cofinsValue?: number;
  cbsRate?: number;
  cbsValue?: number;
  ibsRate?: number;
  ibsValue?: number;
  // Campos de Inteligência (CST/CSOSN)
  cstIcms?: string;
  csosn?: string;
  cstPis?: string;
  cstCofins?: string;
  // Aproveitamento MANUAL (Override) informado pelo usuário por item
  manualUtilization?: {
    icms?: number;
    pis?: number;
    cofins?: number;
    ipi?: number;
  };
  // Configuração Fiscal do Comprador (Fallback)
  utilizationConfig?: {
    icms: number;
    pis: number;
    cofins: number;
    ipi: number;
  };
}

@Injectable()
export class TaxCreditService {

  private percentage(value: number | undefined, fallback = 0) {
    const candidate = value === undefined || value === null || !Number.isFinite(Number(value))
      ? Number(fallback)
      : Number(value);
    return Math.min(100, Math.max(0, Number.isFinite(candidate) ? candidate : 0));
  }

  private invoiceValue(value: number | undefined, calculated: number) {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) return calculated;
    const informed = Math.max(0, Number(value));
    // Colunas legadas possuem default zero. Quando há alíquota positiva, esse
    // zero técnico não deve anular a estimativa por percentual.
    return informed === 0 && calculated > 0 ? calculated : informed;
  }
  
  calculate(ctx: TaxContext) {
    const { 
      buyerRegime, supplierRegime, itemUseType, 
      price, quantity, freight,
      ipiRate, icmsRate, pisRate, cofinsRate,
      ipiValue, icmsValue, pisValue, cofinsValue,
      cbsRate = 0, cbsValue = 0, ibsRate = 0, ibsValue = 0,
      cstIcms, csosn, cstPis, cstCofins,
      manualUtilization,
      utilizationConfig = { icms: 100, pis: 100, cofins: 100, ipi: 100 }
    } = ctx;

    const freightPerUnit = freight / (quantity || 1);

    // 1. Valores Nominais
    const normalizedRates = {
      ipi: this.percentage(ipiRate),
      icms: this.percentage(icmsRate),
      pis: this.percentage(pisRate),
      cofins: this.percentage(cofinsRate),
      cbs: this.percentage(cbsRate),
      ibs: this.percentage(ibsRate),
    };
    // Na entrada da NF, o valor destacado prevalece sobre uma estimativa por aliquota.
    const ipiMonetary = this.invoiceValue(ipiValue, price * (normalizedRates.ipi / 100));
    const icmsMonetary = this.invoiceValue(icmsValue, price * (normalizedRates.icms / 100));
    const pisMonetary = this.invoiceValue(pisValue, price * (normalizedRates.pis / 100));
    const cofinsMonetary = this.invoiceValue(cofinsValue, price * (normalizedRates.cofins / 100));

    const grossCostUnit = price + freightPerUnit + ipiMonetary;

    // 2. INTELIGÊNCIA DE SUGESTÃO DE APROVEITAMENTO (Legislação)
    let suggestedIcmsPct = utilizationConfig.icms;
    let suggestedPisPct = utilizationConfig.pis;
    let suggestedCofinsPct = utilizationConfig.cofins;
    let suggestedIpiPct = utilizationConfig.ipi;

    // Sugestão ICMS baseada em CST (00, 10, 20, 70 permitem crédito)
    if (cstIcms) {
      const allowedCsts = ['00', '10', '20', '70'];
      if (!allowedCsts.includes(cstIcms)) {
        suggestedIcmsPct = 0; // CSTs como 40 (Isento), 60 (ST), etc, não geram crédito
      }
    }
    
    // Sugestão para Simples Nacional (CSOSN 101, 201 permitem crédito de ICMS)
    if (supplierRegime === 'SIMPLES') {
      const allowedCsosn = ['101', '201'];
      if (!csosn || !allowedCsosn.includes(csosn)) suggestedIcmsPct = 0;
    }

    // Sugestão PIS/COFINS (CSTs de entrada 50 a 56 permitem crédito no Lucro Real)
    if (cstPis && !['50', '51', '52', '53', '54', '55', '56'].includes(cstPis)) {
      suggestedPisPct = 0;
    }
    if (cstCofins && !['50', '51', '52', '53', '54', '55', '56'].includes(cstCofins)) {
      suggestedCofinsPct = 0;
    }

    // 3. APLICAÇÃO FINAL (Manual tem prioridade sobre Sugestão)
    const finalUtilization = {
      icms: this.percentage(manualUtilization?.icms, suggestedIcmsPct),
      pis: this.percentage(manualUtilization?.pis, suggestedPisPct),
      cofins: this.percentage(manualUtilization?.cofins, suggestedCofinsPct),
      ipi: this.percentage(manualUtilization?.ipi, suggestedIpiPct)
    };

    let creditIcms = 0;
    let creditPis = 0;
    let creditCofins = 0;
    let creditIpi = 0;
    let alerts: string[] = [];

    // REGRA DE OURO: Uso e Consumo NUNCA gera crédito
    if (itemUseType === 'CONSUMPTION') {
       alerts.push('Créditos legados não apropriados automaticamente: item classificado como uso e consumo. Exceções de PIS/Cofins exigem validação fiscal.');
       return {
         grossCost: grossCostUnit,
         creditIcms: 0, creditPis: 0, creditCofins: 0, creditIpi: 0,
         netCost: grossCostUnit,
         alerts,
         taxMemory: { 
           ...ctx, 
           finalUtilization: { icms: 0, pis: 0, cofins: 0, ipi: 0 }, 
           grossCostUnit,
           netCostUnit: grossCostUnit,
           credits: { total: 0 }
         }
       };
    }

    const isInputOrResale = ['INDUSTRIAL_INPUT', 'RESALE', 'FIXED_ASSET'].includes(itemUseType);

    if (isInputOrResale) {
      // ICMS (Real/Presumido)
      if (buyerRegime === 'REAL' || buyerRegime === 'PRESUMIDO') {
         creditIcms = icmsMonetary * (finalUtilization.icms / 100);
         if (finalUtilization.icms < 100) alerts.push(`Aproveitamento ICMS: ${finalUtilization.icms}%`);
      }

      // PIS/COFINS (regime nao cumulativo). A aquisicao de optante pelo
      // Simples nao impede o credito por si so (ADI RFB 15/2007).
      if (buyerRegime === 'REAL') {
        creditPis = pisMonetary * (finalUtilization.pis / 100);
        creditCofins = cofinsMonetary * (finalUtilization.cofins / 100);
      }
    }

    // IPI (Insumo Industrial)
    if (buyerRegime !== 'SIMPLES' && itemUseType === 'INDUSTRIAL_INPUT') {
       creditIpi = ipiMonetary * (finalUtilization.ipi / 100);
    }

    if (supplierRegime === 'SIMPLES' && (creditIcms > 0 || normalizedRates.icms > 0)) {
      alerts.push('ICMS de fornecedor do Simples limitado ao percentual de crédito informado na NF (LC 123/2006, art. 23).');
    }
    if (itemUseType === 'FIXED_ASSET' && creditIcms > 0) {
      alerts.push('Crédito de ICMS do ativo deve ser apropriado em 48 parcelas, sujeito ao CIAP e às saídas tributadas.');
    }
    if (Number(cbsValue) > 0 || Number(ibsValue) > 0 || normalizedRates.cbs > 0 || normalizedRates.ibs > 0) {
      alerts.push('IBS/CBS de 2026 registrados como informativos e não abatidos do TCO; apropriação depende de documento idôneo e extinção do débito.');
    }

    const totalCredits = creditIcms + creditPis + creditCofins + creditIpi;
    const netCostUnit = grossCostUnit - totalCredits;

    return {
      grossCost: grossCostUnit,
      creditIcms, creditPis, creditCofins, creditIpi,
      netCost: netCostUnit,
      taxMemory: {
        calculationDate: new Date().toISOString(),
        ...ctx,
        finalUtilization,
        invoiceValuesUsed: {
          icms: icmsMonetary,
          pis: pisMonetary,
          cofins: cofinsMonetary,
          ipi: ipiMonetary,
          cbs: Math.max(0, Number(cbsValue) || 0),
          ibs: Math.max(0, Number(ibsValue) || 0),
        },
        reformTaxTreatment: 'INFORMATIVE_2026',
        credits: { 
          icms: creditIcms, 
          pis: creditPis, 
          cofins: creditCofins, 
          ipi: creditIpi, 
          total: totalCredits 
        },
        netCostUnit,
        alerts
      },
      alerts
    };
  }
}
