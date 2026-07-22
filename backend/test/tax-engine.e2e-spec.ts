import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TaxEngineModule } from '../src/modules/tax-engine/tax-engine.module';
import { TaxReviewModule } from '../src/modules/tax-review/tax-review.module';
import { TaxReviewRepository } from '../src/modules/tax-review/repositories/tax-review.repository';
import { TaxReviewAutoService } from '../src/modules/tax-review/services/tax-review-auto.service';
import { PrismaService } from '../src/prisma.service';

const mockPrisma = {
  fornecedor: {
    findUnique: jest.fn(),
  },
  quoteTaxSnapshot: {
    create: jest.fn().mockResolvedValue({ id: 'snap-123' }),
    findMany: jest.fn().mockResolvedValue([{ id: 'snap-history' }])
  },
  quote: {
    findUnique: jest.fn()
  },
  taxRuleCatalog: {
    findMany: jest.fn().mockResolvedValue([])
  }
};

const mockTaxReviewRepo = {
  create: jest.fn(),
  findByQuoteId: jest.fn().mockResolvedValue([]),
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
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
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
    expect(response.body.credits.icms).toBe(18);
    expect(response.body).toHaveProperty('memory');
    expect(response.body).toHaveProperty('explanation');
  });

  it('/tax/calculate-quote (POST) com DTO incompleto -> retorna 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/tax/calculate-quote')
      .send({ buyerCompanyId: 'buyer' })
      .expect(400);

    expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('supplierCompanyId must be a string')]));
  });
});
