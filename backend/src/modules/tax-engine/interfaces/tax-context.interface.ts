export interface TaxContext {
  buyer: {
    id: string;
    regime: 'SIMPLES' | 'PRESUMIDO' | 'REAL';
    pisCofinsRegime: 'CUMULATIVE' | 'NON_CUMULATIVE';
    isIcmsTaxpayer: boolean;
    isIpiTaxpayer: boolean;
    state: string;
  };

  supplier: {
    id: string;
    regime: 'SIMPLES' | 'PRESUMIDO' | 'REAL';
    state: string;
  };

  item: {
    quantity: number;
    unitPrice: number;
    totalFreight?: number;
    itemUseType: 'RESALE' | 'INDUSTRIAL_INPUT' | 'CONSUMPTION' | 'FIXED_ASSET';
    creditNature: 'RESALE' | 'INSUMO' | 'FREIGHT' | 'ENERGY' | 'DEPRECIATION' | 'SERVICE' | 'OTHER';
    ncm?: string;
    cfop?: string;
    cest?: string;
    operationType: 'INTERNAL' | 'INTERSTATE';
    originState?: string;
    destinationState?: string;
    cstIcms?: string;
    csosn?: string;
    cstPis?: string;
    cstCofins?: string;
    cstIpi?: string;
    hasIcmsSt?: boolean;
    isMonophase?: boolean;
    isZeroRate?: boolean;
    isSuspended?: boolean;
    isExempt?: boolean;
    icmsRate?: number;
    pisRate?: number;
    cofinsRate?: number;
    ipiRate?: number;
    icmsValue?: number;
    pisValue?: number;
    cofinsValue?: number;
    ipiValue?: number;
  };
}
