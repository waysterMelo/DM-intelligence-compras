import { Module } from '@nestjs/common';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { PrismaService } from '../../prisma.service';
import { TaxCreditModule } from '../tax-engine/tax-credit.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [TaxCreditModule, CompaniesModule],
  controllers: [RequisitionsController],
  providers: [RequisitionsService, PrismaService],
})
export class RequisitionsModule {}
