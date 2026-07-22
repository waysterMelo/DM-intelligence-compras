import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// O StatsService é responsável por fazer cálculos consolidados
// Em vez de retornar cada requisição, ele retorna apenas os números resumidos (KPIs)

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  // Este método faz 4 consultas ao banco ao mesmo tempo para pegar os números do Dashboard
  async getDashboardStats() {
    // 1. Total de Requisições criadas até hoje
    const totalRequests = await this.prisma.requisition.count();

    // 2. Soma de quanto já foi gasto (apenas requisições com status 'Comprado' ou 'Entregue')
    const completedPurchases = await this.prisma.requisition.findMany({
      select: { finalCost: true, quantity: true },
      where: {
        status: { in: ['Comprado', 'Entregue'] }
      }
    });
    const totalSpent = completedPurchases.reduce(
      (sum, item) => sum + ((item.finalCost || 0) * item.quantity),
      0,
    );

    // 3. Contagem de requisições pendentes (Ainda não compradas)
    const pendingCount = await this.prisma.requisition.count({
      where: {
        status: { in: ['Solicitado', 'Cotando'] }
      }
    });

    // 4. Contagem de requisições concluídas (Já compradas ou entregues)
    const completedCount = await this.prisma.requisition.count({
      where: {
        status: { in: ['Comprado', 'Entregue'] }
      }
    });

    // Retornamos um objeto formatado exatamente como o seu Frontend espera
    return {
      totalRequests,
      totalSpent,
      pendingCount,
      completedCount
    };
  }
}
