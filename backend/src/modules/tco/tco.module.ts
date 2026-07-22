import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TcoController } from './tco.controller';
import { TcoService } from './tco.service';

@Module({
  controllers: [TcoController],
  providers: [TcoService, PrismaService],
  exports: [TcoService],
})
export class TcoModule {}
