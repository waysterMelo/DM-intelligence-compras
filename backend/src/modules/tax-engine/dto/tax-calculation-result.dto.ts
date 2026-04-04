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
}
