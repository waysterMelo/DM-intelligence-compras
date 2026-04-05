import { Module } from '@nestjs/common';
import { TaxEngineController } from './controllers/tax-engine.controller';
import { TaxEngineService } from './services/tax-engine.service';
import { GrossCostCalculator } from './services/calculators/gross-cost.calculator';
import { IcmsCalculator } from './services/calculators/icms.calculator';
import { PisCalculator } from './services/calculators/pis.calculator';
import { CofinsCalculator } from './services/calculators/cofins.calculator';
import { IpiCalculator } from './services/calculators/ipi.calculator';
import { TaxMemoryMapper } from './services/mappers/tax-memory.mapper';
import { TaxRuleEngine } from './services/rule-engine/tax-rule.engine';
import { TaxExplanationService } from './services/explanation/tax-explanation.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [TaxEngineController],
  providers: [
    TaxEngineService,
    TaxRuleEngine,
    TaxExplanationService,
    GrossCostCalculator,
    IcmsCalculator,
    PisCalculator,
    CofinsCalculator,
    IpiCalculator,
    TaxMemoryMapper,
    PrismaService
  ],
  exports: [TaxEngineService, TaxRuleEngine],
})
export class TaxEngineModule {}
