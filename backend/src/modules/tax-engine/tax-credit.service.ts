import { Injectable } from '@nestjs/common';

// O TaxCreditEngine é o coração fiscal do sistema
// Ele recebe o contexto da compra e decide o que é crédito recuperável

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
}

@Injectable()
export class TaxCreditService {
  
  calculate(ctx: TaxContext) {
    const { 
      buyerRegime, supplierRegime, itemUseType, 
      price, quantity, freight,
      ipiRate, icmsRate, pisRate, cofinsRate 
    } = ctx;

    const freightPerUnit = freight / (quantity || 1);

    // 1. Calculamos o valor bruto de cada imposto (O que sai do bolso na nota)
    const ipiValue = price * (ipiRate / 100);
    const icmsValue = price * (icmsRate / 100);
    const pisValue = price * (pisRate / 100);
    const cofinsValue = price * (cofinsRate / 100);

    // Custo de Nota (TCO Bruto): Preço + Frete + Impostos "por fora" ou informados
    const grossCostUnit = price + freightPerUnit + ipiValue + icmsValue + pisValue + cofinsValue;

    // 2. LÓGICA DE CRÉDITOS (O que volta para o caixa)
    let creditIcms = 0;
    let creditPis = 0;
    let creditCofins = 0;
    let creditIpi = 0;

    const isInputOrResale = ['INDUSTRIAL_INPUT', 'RESALE'].includes(itemUseType);

    // CRÉDITO DE ICMS
    // Geralmente se for Insumo ou Revenda, gera crédito integral (Exceto se for Consumo/Ativo)
    if (isInputOrResale) {
      creditIcms = icmsValue;
    }

    // CRÉDITO DE PIS/COFINS
    // Só gera crédito se a RA Polymers for LUCRO REAL e for Insumo/Revenda
    if (buyerRegime === 'REAL' && isInputOrResale) {
      creditPis = pisValue;
      creditCofins = cofinsValue;
    }

    // CRÉDITO DE IPI
    // Gera crédito se for Insumo Industrial e Comprador for REAL/PRESUMIDO (Indústria)
    if (buyerRegime !== 'SIMPLES' && itemUseType === 'INDUSTRIAL_INPUT') {
      creditIpi = ipiValue;
    }

    // 3. CUSTO LÍQUIDO (O "Custo Real" para a empresa)
    // Fórmula: Tudo o que paguei - Tudo o que recuperei
    const netCostUnit = grossCostUnit - creditIcms - creditPis - creditCofins - creditIpi;

    // Memória de Cálculo (Para Auditoria)
    const taxMemory = {
      calculationDate: new Date().toISOString(),
      buyerRegime,
      supplierRegime,
      itemUseType,
      grossCostUnit,
      credits: {
        icms: creditIcms,
        pis: creditPis,
        cofins: creditCofins,
        ipi: creditIpi
      },
      netCostUnit
    };

    return {
      creditIcms,
      creditPis,
      creditCofins,
      netCost: netCostUnit,
      taxMemory
    };
  }
}
