import { Module } from '@nestjs/common';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { StatsModule } from './modules/stats/stats.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaxEngineModule } from './modules/tax-engine/tax-engine.module';
import { TaxGovernanceModule } from './modules/tax-governance/tax-governance.module';
import { TaxJobsModule } from './modules/tax-jobs/tax-jobs.module';// Import do Motor Fiscal
import { TaxReviewModule } from './modules/tax-review/tax-review.module';

@Module({
  imports: [
    RequisitionsModule,
    StatsModule,
    CompaniesModule,
    UsersModule,
    AuthModule,
    TaxEngineModule,
    TaxGovernanceModule,
    TaxJobsModule,
    TaxReviewModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
