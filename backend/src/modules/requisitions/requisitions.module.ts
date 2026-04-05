import { Module } from '@nestjs/common';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { PrismaService } from '../../prisma.service';
import { TaxEngineModule } from '../tax-engine/tax-engine.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [TaxEngineModule, CompaniesModule],
  controllers: [RequisitionsController],
  providers: [RequisitionsService, PrismaService],
})
export class RequisitionsModule {}
