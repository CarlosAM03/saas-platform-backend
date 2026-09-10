import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const userWithTenants = {
  userTenants: {
    include: { tenant: true, role: true },
  },
} satisfies Prisma.UserInclude;

@Injectable()
export class UserTenantService {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: userWithTenants,
    });
  }

  findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithTenants,
    });
  }

  async findActiveMembership(userId: string, tenantId: string) {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true, role: true },
    });

    return membership?.tenant.status === 'ACTIVO' ? membership : null;
  }

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

  async addUserToTenant(userId: string, tenantId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found in this tenant');
    return this.prisma.userTenant.create({
      data: { userId, tenantId, roleId },
      include: { tenant: true, role: true },
    });
  }
}
