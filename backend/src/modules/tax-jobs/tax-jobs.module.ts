import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TaxJobsController } from './tax-jobs.controller';
import { TaxJobsWorker } from './tax-jobs.worker';
import { PrismaService } from '../../prisma.service';
import { ReprocessingQueuePort } from './ports/reprocessing-queue.port';
import { PostgresQueueAdapter } from './adapters/postgres-queue.adapter';
import { TaxEngineModule } from '../tax-engine/tax-engine.module';
import { TaxEngineService } from '../tax-engine/services/tax-engine.service';
import { GrossCostCalculator } from '../tax-engine/services/calculators/gross-cost.calculator';
import { IcmsCalculator } from '../tax-engine/services/calculators/icms.calculator';
import { PisCalculator } from '../tax-engine/services/calculators/pis.calculator';
import { CofinsCalculator } from '../tax-engine/services/calculators/cofins.calculator';
import { IpiCalculator } from '../tax-engine/services/calculators/ipi.calculator';
import { TaxMemoryMapper } from '../tax-engine/services/mappers/tax-memory.mapper';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TaxEngineModule
  ],
  controllers: [TaxJobsController],
  providers: [
    PrismaService,
    {
      provide: ReprocessingQueuePort,
      useClass: PostgresQueueAdapter
    },
    TaxEngineService,
    GrossCostCalculator,
    IcmsCalculator,
    PisCalculator,
    CofinsCalculator,
    IpiCalculator,
    TaxMemoryMapper,
    TaxJobsWorker
  ]
})
export class TaxJobsModule {}
