export type Status = 'Solicitado' | 'Cotando' | 'Aprovado' | 'Comprado' | 'Entregue' | 'Rejeitado';
export type Priority = 'Baixa' | 'Normal' | 'Alta' | 'Urgente';
export type Department = 'Produção' | 'Ferramentaria' | 'Manutenção' | 'Escritório' | 'Logística';

// --- DADOS COMERCIAIS PARA COMPRAS E TCO ---

export type TaxRegime = 'SIMPLES' | 'PRESUMIDO' | 'REAL';
export type CompanyRole = 'SUPPLIER' | 'BUYER';
export type ItemUseType = 'RESALE' | 'INDUSTRIAL_INPUT' | 'CONSUMPTION' | 'FIXED_ASSET';
export type PurchaseMode = 'STRATEGIC' | 'QUICK';
export type CostReconciliationStatus = 'NOT_REQUIRED' | 'PENDING_INVOICE' | 'INVOICE_RECEIVED' | 'COST_CONFIRMED' | 'DIVERGENCE_FOUND';
export type DataCompleteness = 'INCOMPLETE' | 'COMPLETE';
export type CostTreatment = 'INCLUDED' | 'ADDITIONAL';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: TaxRegime;
  companyRole: CompanyRole;
  isActive: boolean;
}

export interface SupplierQuote {
  id: string;
  supplierName: string;
  price: number;       // Preço Unitário Bruto (Preço de Nota)
  freight?: number;    // Frete Total do Item
  leadTime?: number;   // Prazo em dias
  paymentTerms?: string; 
  isSelected: boolean;

  // Dados informados pelo fornecedor para estimativa de TCO
  itemUseType?: ItemUseType;
  ncm?: string;
  cest?: string;
  cfop?: string;
  cstIcms?: string;
  csosn?: string;
  hasIcmsSt?: boolean;
  icmsRate?: number;
  icmsValue?: number;
  
  cstPis?: string;
  cstCofins?: string;
  pisRate?: number;
  cofinsRate?: number;
  pisValue?: number;
  cofinsValue?: number;
  
  ipiRate?: number;
  ipiValue?: number;

  cstIbsCbs?: string;
  taxClassCode?: string;
  cbsRate?: number;
  cbsValue?: number;
  ibsRate?: number;
  ibsValue?: number;

  stRate?: number;
  stValue?: number;
  fcpRate?: number;
  fcpValue?: number;
  difalRate?: number;
  difalValue?: number;
  hasFcp?: boolean;
  hasDifal?: boolean;
  ipiTreatment?: CostTreatment;
  stTreatment?: CostTreatment;
  fcpTreatment?: CostTreatment;
  difalTreatment?: CostTreatment;

  utilizationIcms?: number;
  utilizationPis?: number;
  utilizationCofins?: number;
  utilizationIpi?: number;

  // Resultados comerciais mantidos por compatibilidade
  creditIcms?: number;
  creditPis?: number;
  creditCofins?: number;
  creditIpi?: number;
  netCost?: number;     // Custo Líquido Real (impacto no caixa)
  creditSource?: 'NF' | 'CALCULATED' | 'MANUAL';
  taxMemory?: any;      // Memória de cálculo auditável

  // Link com a Empresa Cadastrada
  grossTotalCost?: number;
  estimatedCreditTotal?: number;
  estimatedNetTotal?: number;
  dataCompleteness?: DataCompleteness;
  calculationSource?: 'SUPPLIER_QUOTE' | 'MANUAL_OVERRIDE' | 'INVOICE' | 'LEGACY_ESTIMATE';
  tcoMemory?: { missingFields?: string[]; [key: string]: any };

  companyId?: string;
  company?: Company;
}

export interface Requisition {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedCost: number | null;
  finalCost: number | null;
  paymentTerms?: string; 
  itemUseType?: ItemUseType;
  requestDate: string;
  deliveryDate: string | null;
  status: Status;
  department: Department;
  priority: Priority;
  requester: string;
  notes?: string;
  purchaseMode?: PurchaseMode;
  costReconciliationStatus?: CostReconciliationStatus;
  costReconciledAt?: string;
  purchaseInvoice?: PurchaseInvoice | null;
  quotes: SupplierQuote[];
}

export interface PurchaseInvoice {
  id: string;
  number: string;
  series?: string;
  accessKey: string;
  issueDate: string;
  supplierCnpj: string;
  importSource: 'MANUAL' | 'XML';
  productTotal: number;
  freightTotal: number;
  discountTotal: number;
  grossTotal: number;
  icmsTotal: number;
  ipiTotal: number;
  pisTotal: number;
  cofinsTotal: number;
  stTotal: number;
  fcpTotal: number;
  difalTotal: number;
  cbsTotal: number;
  ibsTotal: number;
  estimatedRecoverableTotal: number;
  actualNetEstimatedTotal: number;
  quotedGrossTotal: number;
  quotedNetEstimatedTotal: number;
  quotedFreightTotal: number;
  quotedTaxTotal: number;
  actualTaxTotal: number;
  freightVariance: number;
  taxVariance: number;
  grossVariance: number;
  netVariance: number;
}

export interface TcoAssumption {
  itemUseType: ItemUseType;
  icmsRecoveryPct: number;
  ipiRecoveryPct: number;
  pisRecoveryPct: number;
  cofinsRecoveryPct: number;
}

export interface QuickPurchaseInput {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  freight?: number;
  supplierId: string;
  department: Department;
  requester: string;
  paymentTerms?: string;
  notes?: string;
}

export interface ManualInvoiceInput {
  number: string;
  series?: string;
  accessKey: string;
  issueDate: string;
  supplierCnpj: string;
  productTotal?: number;
  freightTotal?: number;
  discountTotal?: number;
  grossTotal: number;
  icmsTotal?: number;
  ipiTotal?: number;
  pisTotal?: number;
  cofinsTotal?: number;
  stTotal?: number;
  fcpTotal?: number;
  difalTotal?: number;
  cbsTotal?: number;
  ibsTotal?: number;
}

export interface StatsData {
  totalRequests: number;
  totalSpent: number;
  pendingCount: number;
  completedCount: number;
  awaitingInvoiceCount?: number;
  invoiceDivergenceCount?: number;
  invoiceVarianceTotal?: number;
  averageLeadTime?: number;
}
