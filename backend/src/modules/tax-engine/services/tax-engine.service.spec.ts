import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TaxEngineService } from './tax-engine.service';
import { GrossCostCalculator } from './calculators/gross-cost.calculator';
import { IcmsCalculator } from './calculators/icms.calculator';
import { PisCalculator } from './calculators/pis.calculator';
import { CofinsCalculator } from './calculators/cofins.calculator';
import { IpiCalculator } from './calculators/ipi.calculator';
import { TaxMemoryMapper } from './mappers/tax-memory.mapper';
import { TaxRuleEngine } from './rule-engine/tax-rule.engine';
import { TaxExplanationService } from './explanation/tax-explanation.service';
import { PrismaService } from '../../../prisma.service';
import { TaxReviewAutoService } from '../../tax-review/services/tax-review-auto.service';
import { TaxReviewRepository } from '../../tax-review/repositories/tax-review.repository';

const mockTaxReviewRepo = {
  create: jest.fn(),
  findByQuoteId: jest.fn().mockResolvedValue([]),
};

const mockPrisma = {
  fornecedor: {
    findUnique: jest.fn(),
  },
  quoteTaxSnapshot: {
    create: jest.fn(),
  },
  quote: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  taxRuleCatalog: {
    findMany: jest.fn().mockResolvedValue([]),
  }
};

describe('TaxEngineService (Unit Tests)', () => {
  let service: TaxEngineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxEngineService,
        TaxRuleEngine,
        TaxExplanationService,
        { provide: TaxReviewRepository, useValue: mockTaxReviewRepo },
        TaxReviewAutoService,
        GrossCostCalculator,
        IcmsCalculator,
        PisCalculator,
        CofinsCalculator,
        IpiCalculator,
        TaxMemoryMapper,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TaxEngineService>(TaxEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseItem = {
    quantity: 10,
    unitPrice: 100,
    totalFreight: 50,
    itemUseType: 'INDUSTRIAL_INPUT' as any,
    creditNature: 'INSUMO' as any,
    operationType: 'INTERNAL' as any,
    icmsRate: 18,
    pisRate: 1.65,
    cofinsRate: 7.6,
    ipiRate: 5,
  };

  const setupMockCompanies = (buyerOverrides: any, supplierOverrides: any) => {
    (mockPrisma.fornecedor.findUnique as jest.Mock).mockImplementation(async (args) => {
      if (args.where.id === 'buyer') return { id: 'buyer', taxRegime: 'REAL', pisCofinsRegime: 'NON_CUMULATIVE', isIcmsTaxpayer: true, isIpiTaxpayer: true, state: 'SP', tenantId: 't1', ...buyerOverrides };
      if (args.where.id === 'supp') return { id: 'supp', taxRegime: 'REAL', state: 'SP', tenantId: 't1', ...supplierOverrides };
      return null;
    });
  };

  it('comprador cumulativo -> nega PIS/COFINS', async () => {
    setupMockCompanies({ pisCofinsRegime: 'CUMULATIVE' }, {});
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.credits.pis).toBe(0);
    expect(res.credits.cofins).toBe(0);
  });

  it('comprador não cumulativo -> aprova PIS/COFINS', async () => {
    setupMockCompanies({ pisCofinsRegime: 'NON_CUMULATIVE' }, {});
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.credits.pis).toBeGreaterThan(0);
    expect(res.credits.cofins).toBeGreaterThan(0);
  });

  it('item de uso e consumo -> nega IPI, PIS, COFINS', async () => {
    setupMockCompanies({}, {});
    const item = { ...baseItem, itemUseType: 'CONSUMPTION' as any, creditNature: 'OTHER' as any };
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item });
    expect(res.credits.ipi).toBe(0);
    expect(res.credits.pis).toBe(0);
    expect(res.credits.cofins).toBe(0);
  });

  it('insumo industrial -> aprova IPI', async () => {
    setupMockCompanies({ isIpiTaxpayer: true }, { isIpiTaxpayer: true });
    const item = { ...baseItem, itemUseType: 'INDUSTRIAL_INPUT' as any };
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item });
    expect(res.credits.ipi).toBe(50);
  });

  it('fornecedor do Simples -> registra LC 123', async () => {
    setupMockCompanies({}, { taxRegime: 'SIMPLES' });
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.legalBasis.some((b: string) => b.includes('LC 123'))).toBe(true);
  });

  it('comprador omitindo campos estruturais -> levanta BadRequestException', async () => {
    setupMockCompanies({ pisCofinsRegime: undefined }, {});
    await expect(service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem })).rejects.toThrow(BadRequestException);
  });

  it('explanation é gerada com summary e linhas', async () => {
    setupMockCompanies({ pisCofinsRegime: 'NON_CUMULATIVE' }, {});
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.explanation).toBeDefined();
    expect(res.explanation?.summary).toBeDefined();
    expect(res.explanation?.lines.length).toBe(4); // ICMS, PIS, COFINS, IPI
    expect(res.explanation?.lines[0].tax).toBe('ICMS');
  });
});
