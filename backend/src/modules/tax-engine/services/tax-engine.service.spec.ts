import { Test, TestingModule } from '@nestjs/testing';
import { TaxEngineService } from './tax-engine.service';
import { GrossCostCalculator } from './calculators/gross-cost.calculator';
import { IcmsCalculator } from './calculators/icms.calculator';
import { PisCalculator } from './calculators/pis.calculator';
import { CofinsCalculator } from './calculators/cofins.calculator';
import { IpiCalculator } from './calculators/ipi.calculator';
import { TaxMemoryMapper } from './mappers/tax-memory.mapper';
import { PrismaService } from '../../../prisma.service';

const mockPrisma = {
  fornecedor: {
    findUnique: jest.fn(),
  },
  quoteTaxSnapshot: {
    create: jest.fn(),
  }
};

describe('TaxEngineService (Unit Tests)', () => {
  let service: TaxEngineService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxEngineService,
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
      if (args.where.id === 'buyer') return { id: 'buyer', taxRegime: 'REAL', pisCofinsRegime: 'NON_CUMULATIVE', isIcmsTaxpayer: true, isIpiTaxpayer: true, state: 'SP', ...buyerOverrides };
      if (args.where.id === 'supp') return { id: 'supp', taxRegime: 'REAL', state: 'SP', ...supplierOverrides };
      return null;
    });
  };

  it('comprador cumulativo -> nega PIS/COFINS', async () => {
    setupMockCompanies({ pisCofinsRegime: 'CUMULATIVE' }, {});
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.credits.pis).toBe(0);
    expect(res.credits.cofins).toBe(0);
    expect(res.disallowedCredits.pis).toContain('Comprador não está no regime de Não Cumulatividade');
  });

  it('comprador não cumulativo -> aprova PIS/COFINS', async () => {
    setupMockCompanies({ pisCofinsRegime: 'NON_CUMULATIVE' }, {});
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.credits.pis).toBeGreaterThan(0);
    expect(res.credits.cofins).toBeGreaterThan(0);
  });

  it('item de uso e consumo -> nega IPI, aceita ICMS/PIS/COFINS dependendo', async () => {
    setupMockCompanies({}, {});
    const item = { ...baseItem, itemUseType: 'CONSUMPTION' as any, creditNature: 'OTHER' as any };
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item });
    expect(res.credits.ipi).toBe(0); 
    expect(res.credits.pis).toBe(0); 
    expect(res.credits.cofins).toBe(0);
  });

  it('insumo industrial -> aprova IPI', async () => {
    setupMockCompanies({ isIpiTaxpayer: true }, {});
    const item = { ...baseItem, itemUseType: 'INDUSTRIAL_INPUT' as any };
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item });
    expect(res.credits.ipi).toBe(50); 
  });

  it('item com ICMS-ST -> nega ICMS', async () => {
    setupMockCompanies({}, {});
    const item = { ...baseItem, hasIcmsSt: true };
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item });
    expect(res.credits.icms).toBe(0);
    expect(res.disallowedCredits.icms).toContain('Item sujeito a Substituição Tributária (ICMS-ST)');
  });

  it('fornecedor do Simples -> registra LC 123', async () => {
    setupMockCompanies({}, { taxRegime: 'SIMPLES' });
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.legalBasis).toContain('LC 123/2006 Art. 23');
  });

  it('comprador não contribuinte de ICMS -> nega ICMS', async () => {
    setupMockCompanies({ isIcmsTaxpayer: false }, {});
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.credits.icms).toBe(0);
  });

  it('comprador sem perfil de IPI -> nega IPI', async () => {
    setupMockCompanies({ isIpiTaxpayer: false }, {});
    const res = await service.calculate({ buyerCompanyId: 'buyer', supplierCompanyId: 'supp', item: baseItem });
    expect(res.credits.ipi).toBe(0);
  });
});
