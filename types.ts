export type Status = 'Solicitado' | 'Cotando' | 'Aprovado' | 'Comprado' | 'Entregue' | 'Rejeitado';
export type Priority = 'Baixa' | 'Normal' | 'Alta' | 'Urgente';
export type Department = 'Produção' | 'Ferramentaria' | 'Manutenção' | 'Escritório' | 'Logística';

// --- MÓDULO FISCAL (FASE 1) ---

export type TaxRegime = 'SIMPLES' | 'PRESUMIDO' | 'REAL';
export type CompanyRole = 'SUPPLIER' | 'BUYER';
export type ItemUseType = 'RESALE' | 'INDUSTRIAL_INPUT' | 'CONSUMPTION' | 'FIXED_ASSET';

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

  // Campos Fiscais de Entrada (Para cálculo de TCO)
  itemUseType?: ItemUseType;
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

  // Resultados Fiscais (Custo Efetivo)
  creditIcms?: number;
  creditPis?: number;
  creditCofins?: number;
  netCost?: number;     // Custo Líquido Real (impacto no caixa)
  creditSource?: 'NF' | 'CALCULATED' | 'MANUAL';
  taxMemory?: any;      // Memória de cálculo auditável

  // Link com a Empresa Cadastrada
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
  requestDate: string;
  deliveryDate: string | null;
  status: Status;
  department: Department;
  priority: Priority;
  requester: string;
  notes?: string;
  quotes: SupplierQuote[];
}

export interface StatsData {
  totalRequests: number;
  totalSpent: number;
  pendingCount: number;
  completedCount: number;
}