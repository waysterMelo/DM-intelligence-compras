import { Module } from '@nestjs/common';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { StatsModule } from './modules/stats/stats.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    RequisitionsModule, 
    StatsModule, 
    CompaniesModule, 
    UsersModule, 
    AuthModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
