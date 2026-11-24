import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../common/context/tenant-context.service';
import { normalizeEmail } from '../common/validation/normalize-email';
import { RegistrationPersistence } from './registration.persistence';
import { DeliveryService } from './delivery.service';
import { RegisterTenantRequest } from './registration.dto';
import { newSecret, secretHash } from './activation.service';
import { TenantOnboardingResponse } from './registration.response';

@Injectable()
export class TenantRegistrationService {
  constructor(
    private readonly persistence: RegistrationPersistence,
    private readonly delivery: DeliveryService,
    private readonly context: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  private requireEnabled() {
    const flag = this.config.get<boolean | string>(
      'TENANT_REGISTRATION_ENABLED',
    );
    if (flag !== true && flag !== 'true')
      throw new ServiceUnavailableException({
        message: 'Tenant registration disabled',
        details: { reason: 'TENANT_REGISTRATION_DISABLED' },
      });
  }

  async register(dto: RegisterTenantRequest) {
    this.requireEnabled();
    const actor = this.context.getRequiredContext();
    const email = normalizeEmail(dto.ownerEmail);
    try {
      const created = await this.persistence.serializable(async (tx) => {
        await this.requireCurrentAdmin(tx, actor.userId);
        const tenant = await tx.tenant.create({
          data: {
            name: dto.tenantName.trim(),
            slug: dto.tenantSlug,
            status: 'ACTIVO',
            roles: { create: [{ name: 'OWNER' }, { name: 'MEMBER' }] },
          },
          include: { roles: true },
        });
        const user = await tx.user.create({
          data: {
            name: dto.ownerName.trim(),
            email,
            passwordHash: `!activation-only!${secretHash(newSecret())}`,
            mustChangePassword: true,
            platformRole: null,
            status: 'ACTIVO',
          },
        });
        await tx.userTenant.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            roleId: tenant.roles.find((r) => r.name === 'OWNER')!.id,
          },
        });
        const o = await tx.tenantOnboarding.create({
          data: {
            tenantId: tenant.id,
            ownerUserId: user.id,
            createdBy: actor.userId,
          },
        });
        const reservation = await this.delivery.reserve(tx, o.id);
        return {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
          },
          reservation,
          user,
        };
      });
      await this.delivery.send(
        created.reservation,
        created.user.email,
        created.user.name,
        created.tenant.name,
      );
      return {
        tenant: created.tenant,
        onboarding: await this.get(created.tenant.id),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Tenant slug or owner email already exists',
        );
      throw error;
    }
  }

  async get(tenantId: string): Promise<TenantOnboardingResponse> {
    return this.persistence.read(async (tx) => {
      const now = await this.persistence.now(tx);
      const o = await tx.tenantOnboarding.findUnique({
        where: { tenantId },
        include: {
          owner: { select: { email: true } },
          attempts: { orderBy: { generation: 'desc' }, take: 1 },
          links: { orderBy: { generation: 'desc' }, take: 1 },
        },
      });
      if (!o) throw new NotFoundException('Onboarding not found');
      const attempt = o.attempts[0];
      return {
        tenantId: o.tenantId,
        ownerUserId: o.ownerUserId,
        ownerEmail: o.owner.email,
        activationStatus: o.activationStatus,
        deliveryStatus:
          attempt?.status === 'SENDING' && attempt.leaseExpiresAt <= now
            ? 'UNKNOWN'
            : o.deliveryStatus,
        createdAt: o.createdAt,
        lastAttemptAt: attempt?.createdAt ?? null,
        providerAcceptedAt: attempt?.providerAcceptedAt ?? null,
        activationLinkExpiresAt: o.links[0]?.expiresAt ?? null,
        completedAt: o.completedAt,
      };
    });
  }

  async resend(tenantId: string) {
    this.requireEnabled();
    const data = await this.persistence.serializable(async (tx) => {
      await this.requireCurrentAdmin(
        tx,
        this.context.getRequiredContext().userId,
      );
      const found = await tx.tenantOnboarding.findUnique({
        where: { tenantId },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('Onboarding not found');
      await this.persistence.lock(tx, found.id);
      const o = await tx.tenantOnboarding.findUniqueOrThrow({
        where: { id: found.id },
        include: { owner: true, tenant: true },
      });
      return {
        reservation: await this.delivery.reserve(tx, found.id),
        email: o.owner.email,
        name: o.owner.name,
        tenantName: o.tenant.name,
      };
    });
    await this.delivery.send(
      data.reservation,
      data.email,
      data.name,
      data.tenantName,
    );
    return this.get(tenantId);
  }

  private async requireCurrentAdmin(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR SHARE`;
    const actor = await tx.user.findUnique({ where: { id: userId } });
    if (
      !actor ||
      actor.platformRole !== 'ADMIN' ||
      actor.status !== 'ACTIVO' ||
      actor.mustChangePassword
    )
      throw new ForbiddenException('Current platform administration required');
  }
}
