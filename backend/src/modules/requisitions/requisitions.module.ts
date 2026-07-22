import { Module } from '@nestjs/common';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { PrismaService } from '../../prisma.service';
import { TcoModule } from '../tco/tco.module';
import { NfeXmlService } from './nfe-xml.service';

@Module({
  imports: [TcoModule],
  controllers: [RequisitionsController],
  providers: [RequisitionsService, PrismaService, NfeXmlService],
})
export class RequisitionsModule {}
