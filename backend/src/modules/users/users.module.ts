import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  exports: [UsersService], // Exporting service
})
export class UsersModule {
  constructor() {
    console.log('✅ UsersModule carregado com sucesso!');
  }
}
