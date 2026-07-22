export interface RecoveryAssumptions {
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
}

export interface TcoInput {
  companyId?: string;
  supplierName?: string;
  itemUseType: string;
  quantity: number;
  price: number;
  freight?: number;
  icmsRate?: number | null;
  icmsValue?: number | null;
  ipiRate?: number | null;
  ipiValue?: number | null;
  pisRate?: number | null;
  pisValue?: number | null;
  cofinsRate?: number | null;
  cofinsValue?: number | null;
  stRate?: number | null;
  stValue?: number | null;
  fcpRate?: number | null;
  fcpValue?: number | null;
  difalRate?: number | null;
  difalValue?: number | null;
  hasIcmsSt?: boolean;
  hasFcp?: boolean;
  hasDifal?: boolean;
  ipiTreatment?: string;
  stTreatment?: string;
  fcpTreatment?: string;
  difalTreatment?: string;
  utilizationIcms?: number | null;
  utilizationIpi?: number | null;
  utilizationPis?: number | null;
  utilizationCofins?: number | null;
}

const money = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const percentage = (value: unknown, fallback = 0) => {
  const parsed = value === undefined || value === null ? fallback : Number(value);
  return Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : fallback));
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const isProvided = (value: unknown) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

const resolveTax = (price: number, rate: unknown, value: unknown) => {
  if (isProvided(value)) return { amount: money(value), source: 'AMOUNT' as const };
  if (isProvided(rate)) return { amount: round(price * percentage(rate) / 100), source: 'RATE' as const };
  return { amount: 0, source: 'MISSING' as const };
};

export const calculateTco = (input: TcoInput, defaults: RecoveryAssumptions) => {
  const quantity = money(input.quantity);
  const price = money(input.price);
  const freight = money(input.freight);
  const taxes = {
    icms: resolveTax(price, input.icmsRate, input.icmsValue),
    ipi: resolveTax(price, input.ipiRate, input.ipiValue),
    pis: resolveTax(price, input.pisRate, input.pisValue),
    cofins: resolveTax(price, input.cofinsRate, input.cofinsValue),
    st: resolveTax(price, input.stRate, input.stValue),
    fcp: resolveTax(price, input.fcpRate, input.fcpValue),
    difal: resolveTax(price, input.difalRate, input.difalValue),
  };
  const recovery = {
    icms: percentage(input.utilizationIcms, defaults.icms),
    ipi: percentage(input.utilizationIpi, defaults.ipi),
    pis: percentage(input.utilizationPis, defaults.pis),
    cofins: percentage(input.utilizationCofins, defaults.cofins),
  };
  const hasManualOverride = [input.utilizationIcms, input.utilizationIpi, input.utilizationPis, input.utilizationCofins].some(isProvided);
  const missingFields: string[] = [];
  if (!input.companyId && !String(input.supplierName || '').trim()) missingFields.push('fornecedor');
  if (quantity <= 0) missingFields.push('quantidade');
  if (price <= 0) missingFields.push('preço unitário');
  (['icms', 'ipi', 'pis', 'cofins'] as const).forEach(tax => {
    if (recovery[tax] > 0 && taxes[tax].source === 'MISSING') missingFields.push(tax.toUpperCase());
  });
  if ((input.ipiTreatment || 'ADDITIONAL') === 'ADDITIONAL' && taxes.ipi.source === 'MISSING' && !missingFields.includes('IPI')) missingFields.push('IPI');
  if (input.hasIcmsSt && taxes.st.source === 'MISSING') missingFields.push('ICMS-ST');
  if (input.hasFcp && taxes.fcp.source === 'MISSING') missingFields.push('FCP');
  if (input.hasDifal && taxes.difal.source === 'MISSING') missingFields.push('DIFAL');

  const additionalUnit =
    ((input.ipiTreatment || 'ADDITIONAL') === 'ADDITIONAL' ? taxes.ipi.amount : 0) +
    (input.hasIcmsSt && (input.stTreatment || 'ADDITIONAL') === 'ADDITIONAL' ? taxes.st.amount : 0) +
    (input.hasFcp && (input.fcpTreatment || 'ADDITIONAL') === 'ADDITIONAL' ? taxes.fcp.amount : 0) +
    (input.hasDifal && (input.difalTreatment || 'ADDITIONAL') === 'ADDITIONAL' ? taxes.difal.amount : 0);
  const grossTotalCost = round((price + additionalUnit) * quantity + freight);
  const credits = {
    icms: round(taxes.icms.amount * quantity * recovery.icms / 100),
    ipi: round(taxes.ipi.amount * quantity * recovery.ipi / 100),
    pis: round(taxes.pis.amount * quantity * recovery.pis / 100),
    cofins: round(taxes.cofins.amount * quantity * recovery.cofins / 100),
  };
  const estimatedCreditTotal = round(Object.values(credits).reduce((sum, value) => sum + value, 0));
  const estimatedNetTotal = round(grossTotalCost - estimatedCreditTotal);

  return {
    grossTotalCost,
    estimatedCreditTotal,
    estimatedNetTotal,
    netCost: quantity > 0 ? round(estimatedNetTotal / quantity) : 0,
    dataCompleteness: missingFields.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    calculationSource: hasManualOverride ? 'MANUAL_OVERRIDE' : 'SUPPLIER_QUOTE',
    missingFields,
    recovery,
    credits,
    resolvedTaxes: taxes,
    tcoMemory: {
      calculationDate: new Date().toISOString(),
      purpose: 'PROCUREMENT_ESTIMATE',
      formula: 'commercial price + freight + additional informed taxes - estimated recoveries',
      quantity,
      price,
      freight,
      additionalUnit,
      recovery,
      credits,
      resolvedTaxes: taxes,
      hasManualOverride,
      missingFields,
    },
  };
};

export const calculateInvoiceTco = (totals: { grossTotal: number; icmsTotal?: number; ipiTotal?: number; pisTotal?: number; cofinsTotal?: number }, assumptions: RecoveryAssumptions) => {
  const estimatedRecoverableTotal = round(
    money(totals.icmsTotal) * percentage(assumptions.icms) / 100 +
    money(totals.ipiTotal) * percentage(assumptions.ipi) / 100 +
    money(totals.pisTotal) * percentage(assumptions.pis) / 100 +
    money(totals.cofinsTotal) * percentage(assumptions.cofins) / 100,
  );
  return { estimatedRecoverableTotal, actualNetEstimatedTotal: round(money(totals.grossTotal) - estimatedRecoverableTotal) };
};
