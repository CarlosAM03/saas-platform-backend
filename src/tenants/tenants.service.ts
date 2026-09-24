import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../common/context/tenant-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantRequest } from './dto/create-tenant.request';
import { TenantResponse } from './dto/tenant.response';

const tenantSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  findAll(): Promise<TenantResponse[]> {
    // This is tenant discovery, so it must work before selecting a tenant.
    return this.prisma.tenant.findMany({
      where: this.accessibleTenants(),
      select: tenantSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(id: string): Promise<TenantResponse> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { ...this.accessibleTenants(), id },
      select: tenantSelect,
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async create(request: CreateTenantRequest): Promise<TenantResponse> {
    if (this.tenantContext.getPlatformRole() !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can create tenants');
    }

    try {
      // A nested write creates the tenant and its roles atomically. ADMIN
      // remains global: creating a tenant does not create a membership.
      return await this.prisma.tenant.create({
        data: {
          name: request.name,
          slug: request.slug,
          roles: { create: [{ name: 'OWNER' }, { name: 'MEMBER' }] },
        },
        select: tenantSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A tenant with that slug already exists');
      }
      throw error;
    }
  }

  private accessibleTenants(): Prisma.TenantWhereInput {
    const context = this.tenantContext.getRequiredContext();
    return context.platformRole === 'ADMIN'
      ? {}
      : {
          status: 'ACTIVO',
          userTenants: { some: { userId: context.userId } },
        };
  }
}
