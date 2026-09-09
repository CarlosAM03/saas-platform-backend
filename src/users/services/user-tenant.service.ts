import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserTenantService {
  constructor(private readonly prisma: PrismaService) {}

  findTenantsByUser(userId: string) {
    return this.prisma.userTenant.findMany({
      where: { userId, tenant: { status: 'ACTIVO' } },
      include: { tenant: true, role: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async validateMembership(userId: string, tenantId: string): Promise<boolean> {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true },
    });

    return Boolean(membership && membership.tenant.status === 'ACTIVO');
  }

  addUserToTenant(userId: string, tenantId: string, roleId: string) {
    return this.prisma.userTenant.create({
      data: { userId, tenantId, roleId },
      include: { tenant: true, role: true },
    });
  }
}
