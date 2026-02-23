import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, PrismaService],
  // Exportamos o serviço para que outros módulos (como o de requisições) possam usá-lo depois
  exports: [CompaniesService]
})
export class CompaniesModule {}
