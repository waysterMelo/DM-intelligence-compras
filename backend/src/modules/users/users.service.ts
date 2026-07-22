import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; username: string; password: string; role: string; companyId: string }) {
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictException('Usuário já existe');

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Validar role contra enum
    const validRoles = ['BUYER', 'MANAGER', 'ADMIN', 'SPECIALIST'];
    const role = validRoles.includes(data.role) ? data.role : 'BUYER';

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        password: hashedPassword,
        role: role as any,
        fornecedorId: data.companyId
      },
      include: { fornecedor: true }
    });

    return { ...user, company: user.fornecedor };
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { fornecedor: true }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Map back for frontend compatibility
    return { ...user, company: user.fornecedor };
  }
}
