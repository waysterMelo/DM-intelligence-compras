import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// O PrismaService é uma classe "ajudante" (Service)
// Ela herda o PrismaClient para que possamos fazer consultas ao banco (SELECT, INSERT, etc)
// O @Injectable permite que o NestJS o envie para outras partes do sistema automaticamente

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // Quando o servidor ligar (onModuleInit), o Prisma conecta ao banco de dados
  async onModuleInit() {
    await this.$connect();
  }
}
