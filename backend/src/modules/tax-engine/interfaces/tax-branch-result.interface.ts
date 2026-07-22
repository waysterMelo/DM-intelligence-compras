export interface TaxBranchResult {
  tax: 'ICMS' | 'PIS' | 'COFINS' | 'IPI';
  eligible: boolean;
  creditAmount: number;
  disallowedReasons: string[];
  legalBasis: string[];
  formula?: string;
  baseAmount?: number;
  rate?: number;
}
