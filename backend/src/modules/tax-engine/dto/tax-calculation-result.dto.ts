export class TaxCalculationResultDto {
  grossCostUnit: number;
  grossCostTotal: number;
  netCostUnit: number;
  netCostTotal: number;

  credits: {
    icms: number;
    pis: number;
    cofins: number;
    ipi: number;
  };

  disallowedCredits: {
    icms?: string[];
    pis?: string[];
    cofins?: string[];
    ipi?: string[];
  };

  legalBasis: string[];
  memory: any;
  governance: {
    confidenceLevel: 'ESTIMATED' | 'VALIDATED_BY_REGISTRATION' | 'VALIDATED_BY_DOCUMENT' | 'BLOCKED' | 'EXPERT_REVIEWED';
    calculationStatus: 'PENDING' | 'SUCCESS' | 'BLOCKED' | 'IN_REVIEW';
    ruleCodes: string[];
    decisionSummary: any;
  };

  // Fase 5: Explicação consistente do cálculo
  explanation?: {
    summary: string;
    lines: Array<{
      tax: string;
      baseValue: number;
      rate: number;
      creditAmount: number;
      eligible: boolean;
      reason: string;
      legalBasis: string[];
      ruleCode: string;
    }>;
    totalCredits: number;
    grossCost: number;
    netCost: number;
    blocked: boolean;
    blockReason?: string;
  };
}
