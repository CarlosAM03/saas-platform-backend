import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  findRolesByTenant(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getRoleByName(tenantId: string, name: RoleName) {
    const role = await this.prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
    if (!role) {
      throw new NotFoundException(`Role ${name} not found for tenant`);
    }

    return role;
  }

  async getRoleById(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) {
      throw new NotFoundException('Role not found for tenant');
    }

    return role;
  }
}
