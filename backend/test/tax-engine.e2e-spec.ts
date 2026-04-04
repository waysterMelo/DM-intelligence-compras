import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TaxEngineModule } from '../src/modules/tax-engine/tax-engine.module';
import { PrismaService } from '../src/prisma.service';

const mockPrisma = {
  fornecedor: {
    findUnique: jest.fn(),
  },
  quoteTaxSnapshot: {
    create: jest.fn().mockResolvedValue({ id: 'snap-123' }),
  }
};

describe('TaxEngineController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TaxEngineModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/tax/calculate-quote (POST) retorna estrutura completa', async () => {
    mockPrisma.fornecedor.findUnique.mockResolvedValue({
      id: 'mock-id',
      taxRegime: 'REAL',
      pisCofinsRegime: 'NON_CUMULATIVE',
      isIcmsTaxpayer: true,
      isIpiTaxpayer: true,
      state: 'SP'
    });

    const payload = {
      buyerCompanyId: 'buyer-id',
      supplierCompanyId: 'supp-id',
      item: {
        quantity: 1,
        unitPrice: 100,
        icmsRate: 18,
        pisRate: 1.65,
        cofinsRate: 7.6,
        ipiRate: 5,
        itemUseType: 'INDUSTRIAL_INPUT',
        creditNature: 'INSUMO',
        operationType: 'INTERNAL'
      }
    };

    const response = await request(app.getHttpServer())
      .post('/tax/calculate-quote')
      .send(payload)
      .expect(201);

    expect(response.body).toHaveProperty('grossCostTotal');
    expect(response.body).toHaveProperty('netCostTotal');
    expect(response.body.credits).toHaveProperty('icms');
    expect(response.body.credits.icms).toBe(18); // 100 * 18%
    expect(response.body).toHaveProperty('memory');
  });

  it('/tax/quotes/:id/tax-snapshot (POST) salva o snapshot e retorna', async () => {
    mockPrisma.fornecedor.findUnique.mockResolvedValue({
      id: 'mock-id',
      taxRegime: 'REAL',
      pisCofinsRegime: 'NON_CUMULATIVE',
      isIcmsTaxpayer: true,
      isIpiTaxpayer: true,
      state: 'SP'
    });

    const payload = {
      buyerCompanyId: 'buyer-id',
      supplierCompanyId: 'supp-id',
      item: {
        quantity: 1,
        unitPrice: 100,
        icmsRate: 18,
        itemUseType: 'INDUSTRIAL_INPUT',
        creditNature: 'INSUMO',
        operationType: 'INTERNAL'
      }
    };

    const response = await request(app.getHttpServer())
      .post('/tax/quotes/test-quote-99/tax-snapshot')
      .send(payload)
      .expect(201);

    expect(response.body).toHaveProperty('id', 'snap-123');
    expect(mockPrisma.quoteTaxSnapshot.create).toHaveBeenCalled();
  });
});
