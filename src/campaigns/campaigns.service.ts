import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/context/tenant-context.service';
import {
  PaginationDto,
  createPaginationMeta,
} from '../common/dto/pagination.dto';
import {
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from './dto/campaign.request';
import { CampaignResponse } from './dto/campaign.response';
import {
  CommercialEvaluation,
  CommercialStage,
  CampaignActivityType,
} from '@prisma/client';
import { CampaignProspectsQuery } from './dto/campaign-prospects.query';

const campaignSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CampaignSelect;

const prospectSelect = {
  id: true,
  campaignId: true,
  name: true,
  category: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  source: true,
  sourceIdentifier: true,
  language: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProspectSelect;

const responsibleSelect = (tenantId: string) =>
  ({
    id: true,
    name: true,
    email: true,
    status: true,
    userTenants: { where: { tenantId }, select: { tenantId: true } },
  }) satisfies Prisma.UserSelect;

type ResponsibleWithMembership = Prisma.UserGetPayload<{
  select: ReturnType<typeof responsibleSelect>;
}>;

function withResponsibleEligibility<
  T extends { responsible: ResponsibleWithMembership | null },
>(participation: T) {
  const { responsible, ...fields } = participation;
  if (!responsible) return { ...fields, responsible: null };
  const { userTenants, ...user } = responsible;
  return {
    ...fields,
    responsible: {
      ...user,
      eligible: user.status === 'ACTIVO' && userTenants.length > 0,
    },
  };
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContextService,
  ) {}

  async create(request: CreateCampaignRequest): Promise<CampaignResponse> {
    return this.prisma.campaign.create({
      data: {
        name: request.name,
        description: request.description,
        tenantId: this.context.requireTenantId(),
        createdBy: this.context.getRequiredContext().userId,
      },
      select: campaignSelect,
    });
  }

  async findAll(query: PaginationDto) {
    const tenantId = this.context.requireTenantId();
    // PaginationDto also serves Users. Campaign has no email column.
    if (query.sortBy === 'email')
      throw new BadRequestException('Invalid campaign sort field');
    const where: Prisma.CampaignWhereInput = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        select: campaignSelect,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return { data, meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async findOne(id: string): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId: this.context.requireTenantId() },
      select: campaignSelect,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(
    id: string,
    request: UpdateCampaignRequest,
  ): Promise<CampaignResponse> {
    const tenantId = this.context.requireTenantId();
    if (Object.values(request).every((value) => value === undefined))
      throw new BadRequestException('At least one field is required');
    try {
      return await this.prisma.campaign.update({
        where: { id, tenantId },
        select: campaignSelect,
        data: {
          name: request.name,
          description: request.description,
          status: request.status,
        },
      });
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async remove(id: string, permanent: boolean): Promise<void> {
    const tenantId = this.context.requireTenantId();
    if (permanent && this.context.getPlatformRole() !== 'ADMIN') {
      throw new ForbiddenException(
        'Only ADMIN can permanently delete campaigns',
      );
    }
    try {
      if (permanent) {
        // Existing foreign keys prevent deleting a campaign that has dependents.
        await this.prisma.campaign.delete({ where: { id, tenantId } });
      } else {
        await this.prisma.campaign.update({
          where: { id, tenantId },
          data: { status: 'ARCHIVADA' },
        });
      }
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async findProspects(id: string, query: CampaignProspectsQuery) {
    const tenantId = this.context.requireTenantId();
    const addedAt = this.dateRange(query.addedFrom, query.addedTo);
    const recordedAt = this.dateRange(query.activityFrom, query.activityTo);
    await this.findOne(id);
    const participationFilter: Prisma.CampaignProspectWhereInput = {
      campaignId: id,
      campaign: { tenantId },
      prospect: { tenantId },
      ...(addedAt ? { addedAt } : {}),
      ...(recordedAt
        ? { activities: { some: { tenantId, campaignId: id, recordedAt } } }
        : {}),
      ...(query.stage
        ? { commercialStage: query.stage as CommercialStage }
        : {}),
      ...(query.evaluation
        ? { evaluation: query.evaluation as CommercialEvaluation }
        : {}),
      ...(query.responsibleId
        ? query.responsibleId === 'UNASSIGNED'
          ? { responsibleId: null }
          : { responsibleId: query.responsibleId }
        : {}),
    };
    const where: Prisma.ProspectWhereInput = {
      tenantId,
      ...(query.category
        ? {
            category: {
              contains: query.category,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.address
        ? {
            address: {
              contains: query.address,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.source
        ? {
            source: query.source,
          }
        : {}),
      AND: [
        {
          OR: [
            { campaignId: id },
            {
              campaignProspects: { some: participationFilter },
            },
          ],
        },
        { campaignProspects: { some: participationFilter } },
        ...(query.search
          ? [
              {
                OR: [
                  {
                    name: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.prospect.findMany({
        where,
        select: {
          ...prospectSelect,
          campaignProspects: {
            where: { campaignId: id, campaign: { tenantId } },
            select: {
              campaignId: true,
              prospectId: true,
              status: true,
              commercialStage: true,
              evaluation: true,
              evaluationReason: true,
              responsibleId: true,
              addedAt: true,
              updatedAt: true,
              responsible: { select: responsibleSelect(tenantId) },
            },
          },
        },
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.prospect.count({ where }),
    ]);
    return {
      data: data.map(({ campaignProspects, ...prospect }) => ({
        ...prospect,
        participation: withResponsibleEligibility(campaignProspects[0]),
      })),
      meta: createPaginationMeta(query.page, query.limit, total),
    };
  }

  async getParticipation(campaignId: string, prospectId: string) {
    const tenantId = this.context.requireTenantId();
    const participation = await this.prisma.campaignProspect.findFirst({
      where: {
        campaignId,
        prospectId,
        campaign: { tenantId },
        prospect: { tenantId },
      },
      include: {
        responsible: {
          select: responsibleSelect(tenantId),
        },
      },
    });
    if (!participation) throw new NotFoundException('Participation not found');
    return withResponsibleEligibility(participation);
  }

  async updateStage(campaignId: string, prospectId: string, stage: string) {
    const nextStage = stage as CommercialStage;
    const tenantId = this.context.requireTenantId();
    const actorUserId = this.context.getRequiredContext().userId;
    return this.prisma.$transaction(async (tx) => {
      await this.lockParticipation(tx, tenantId, campaignId, prospectId);
      const current = await tx.campaignProspect.findFirst({
        where: {
          campaignId,
          prospectId,
          campaign: { tenantId },
          prospect: { tenantId },
        },
      });
      if (!current) throw new NotFoundException('Participation not found');
      if (current.commercialStage === nextStage) return current;
      const updated = await tx.campaignProspect.update({
        where: {
          campaignId_prospectId: { campaignId, prospectId },
        },
        data: { commercialStage: nextStage },
      });
      await tx.campaignActivity.create({
        data: {
          tenantId,
          campaignId,
          prospectId,
          type: CampaignActivityType.STAGE_CHANGE,
          actorUserId,
          previousValue: current.commercialStage,
          newValue: nextStage,
        },
      });
      return updated;
    });
  }

  async updateEvaluation(
    campaignId: string,
    prospectId: string,
    evaluation: string,
    reason?: string,
  ) {
    const nextEvaluation = evaluation as CommercialEvaluation;
    const tenantId = this.context.requireTenantId();
    const actorUserId = this.context.getRequiredContext().userId;
    if (
      nextEvaluation === 'NO_APTO' &&
      (!reason || reason.trim().length === 0)
    ) {
      throw new BadRequestException(
        'A reason is required when evaluation is NO_APTO',
      );
    }
    const cleanReason =
      nextEvaluation === 'NO_APTO' ? reason?.trim() : reason?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      await this.lockParticipation(tx, tenantId, campaignId, prospectId);
      const current = await tx.campaignProspect.findFirst({
        where: {
          campaignId,
          prospectId,
          campaign: { tenantId },
          prospect: { tenantId },
        },
      });
      if (!current) throw new NotFoundException('Participation not found');
      if (
        current.evaluation === nextEvaluation &&
        current.evaluationReason === cleanReason
      ) {
        return current;
      }
      const updated = await tx.campaignProspect.update({
        where: {
          campaignId_prospectId: { campaignId, prospectId },
        },
        data: {
          evaluation: nextEvaluation,
          evaluationReason: cleanReason,
        },
      });
      await tx.campaignActivity.create({
        data: {
          tenantId,
          campaignId,
          prospectId,
          type: CampaignActivityType.EVALUATION_CHANGE,
          actorUserId,
          previousValue: current.evaluation,
          newValue: nextEvaluation,
          reason: cleanReason,
        },
      });
      return updated;
    });
  }

  async eligibleResponsibles(campaignId: string, prospectId: string) {
    const tenantId = this.context.requireTenantId();
    await this.getParticipation(campaignId, prospectId);
    const memberships = await this.prisma.userTenant.findMany({
      where: {
        tenantId,
        user: { status: 'ACTIVO' },
      },
      select: {
        user: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
      orderBy: [{ user: { name: 'asc' } }, { userId: 'asc' }],
    });
    return { data: memberships.map((membership) => membership.user) };
  }

  async assignResponsible(
    campaignId: string,
    prospectId: string,
    responsibleId: string | null,
  ) {
    const tenantId = this.context.requireTenantId();
    const actorUserId = this.context.getRequiredContext().userId;
    return this.prisma.$transaction(async (tx) => {
      await this.lockParticipation(tx, tenantId, campaignId, prospectId);
      const current = await tx.campaignProspect.findFirst({
        where: {
          campaignId,
          prospectId,
          campaign: { tenantId },
          prospect: { tenantId },
        },
        include: {
          responsible: {
            select: responsibleSelect(tenantId),
          },
        },
      });
      if (!current) throw new NotFoundException('Participation not found');
      if (responsibleId) {
        const eligible = await tx.userTenant.findFirst({
          where: {
            tenantId,
            userId: responsibleId,
            user: { status: 'ACTIVO' },
          },
          select: { userId: true },
        });
        if (!eligible) {
          throw new BadRequestException(
            'Responsible must be active and belong to the tenant',
          );
        }
      }
      if (current.responsibleId === responsibleId)
        return withResponsibleEligibility(current);
      const updated = await tx.campaignProspect.update({
        where: {
          campaignId_prospectId: { campaignId, prospectId },
        },
        data: { responsibleId },
        include: {
          responsible: {
            select: responsibleSelect(tenantId),
          },
        },
      });
      await tx.campaignActivity.create({
        data: {
          tenantId,
          campaignId,
          prospectId,
          type: CampaignActivityType.RESPONSIBLE_CHANGE,
          actorUserId,
          previousValue: current.responsibleId,
          newValue: responsibleId,
        },
      });
      return withResponsibleEligibility(updated);
    });
  }

  async activities(
    campaignId: string,
    prospectId: string,
    query: PaginationDto,
  ) {
    const tenantId = this.context.requireTenantId();
    await this.getParticipation(campaignId, prospectId);
    const where = { tenantId, campaignId, prospectId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.campaignActivity.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.campaignActivity.count({ where }),
    ]);
    return { data, meta: createPaginationMeta(query.page, query.limit, total) };
  }

  async createActivity(
    campaignId: string,
    prospectId: string,
    request: {
      type: string;
      content: string;
      declaredAt?: string;
      correctsId?: string;
    },
  ) {
    const tenantId = this.context.requireTenantId();
    const actorUserId = this.context.getRequiredContext().userId;
    let declaredAt: Date | undefined;
    if (request.declaredAt) {
      declaredAt = new Date(request.declaredAt);
      if (Number.isNaN(declaredAt.getTime())) {
        throw new BadRequestException('Invalid declaredAt');
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const participation = await tx.campaignProspect.findFirst({
        where: {
          campaignId,
          prospectId,
          campaign: { tenantId },
          prospect: { tenantId },
        },
      });
      if (!participation)
        throw new NotFoundException('Participation not found');
      if (request.correctsId) {
        const original = await tx.campaignActivity.findFirst({
          where: {
            id: request.correctsId,
            tenantId,
            campaignId,
            prospectId,
          },
        });
        if (!original) throw new NotFoundException('Activity not found');
      }
      const type = (
        request.correctsId ? CampaignActivityType.CORRECTION : request.type
      ) as CampaignActivityType;
      return tx.campaignActivity.create({
        data: {
          tenantId,
          campaignId,
          prospectId,
          type,
          content: request.content,
          declaredAt,
          actorUserId,
          correctsId: request.correctsId,
        },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async dashboard(campaignId: string) {
    const tenantId = this.context.requireTenantId();
    // Every aggregate must come from one snapshot. Sequential reads let a
    // concurrent writer produce totals that do not add up.
    const [participations, activities, manualActivities] =
      await this.prisma.$transaction(
        async (tx) => {
          const campaign = await tx.campaign.findFirst({
            where: { id: campaignId, tenantId },
            select: { id: true },
          });
          if (!campaign) throw new NotFoundException('Campaign not found');
          const participations = await tx.campaignProspect.findMany({
            where: {
              campaignId,
              campaign: { tenantId },
              prospect: { tenantId },
            },
            include: {
              prospect: {
                select: {
                  id: true,
                  provenanceEvents: {
                    where: {
                      tenantId,
                      campaignId,
                      type: { in: ['CREATED', 'LINKED'] },
                    },
                    orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
                    take: 1,
                    select: {
                      type: true,
                      campaignId: true,
                    },
                  },
                },
              },
              responsible: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  userTenants: {
                    where: { tenantId },
                    select: { tenantId: true },
                  },
                },
              },
            },
          });
          // Manual declarations include CORRECTION: a correction is written by a
          // human referencing a previous entry, so it counts as manual activity.
          // Automatic events (ASSOCIATION/STAGE_CHANGE/EVALUATION_CHANGE/
          // RESPONSIBLE_CHANGE) stay in events = total - manual.
          const manualTypes = [
            CampaignActivityType.NOTE,
            CampaignActivityType.CALL,
            CampaignActivityType.EMAIL,
            CampaignActivityType.MEETING,
            CampaignActivityType.OTHER,
            CampaignActivityType.CORRECTION,
          ];
          const [activities, manualActivities] = await Promise.all([
            tx.campaignActivity.count({
              where: { tenantId, campaignId },
            }),
            tx.campaignActivity.count({
              where: {
                tenantId,
                campaignId,
                type: { in: manualTypes },
              },
            }),
          ]);
          return [participations, activities, manualActivities] as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    const stages: Record<string, number> = {
      SIN_GESTIONAR: 0,
      EN_INVESTIGACION: 0,
      CONTACTADO: 0,
      EN_SEGUIMIENTO: 0,
      OPORTUNIDAD: 0,
      CERRADO: 0,
    };
    const evaluations: Record<string, number> = {
      SIN_EVALUAR: 0,
      APTO: 0,
      NO_APTO: 0,
    };
    const responsibility: Record<string, number> = {};
    const incorporation = {
      new: 0,
      reused: 0,
      unknownLegacy: 0,
    };
    for (const participation of participations) {
      stages[participation.commercialStage]++;
      evaluations[participation.evaluation]++;
      if (!participation.responsibleId) {
        responsibility['SIN_ASIGNAR'] =
          (responsibility['SIN_ASIGNAR'] ?? 0) + 1;
      } else {
        const responsibleStatus =
          participation.responsible?.status === 'ACTIVO' &&
          participation.responsible.userTenants.length > 0
            ? participation.responsibleId
            : `NO_ELEGIBLE:${participation.responsibleId}`;
        responsibility[responsibleStatus] =
          (responsibility[responsibleStatus] ?? 0) + 1;
      }
      const origin = participation.prospect.provenanceEvents[0];
      if (!origin) {
        incorporation.unknownLegacy++;
      } else if (origin.type === 'CREATED') {
        incorporation.new++;
      } else {
        incorporation.reused++;
      }
    }
    return {
      total: participations.length,
      stages,
      evaluations,
      responsibility,
      activity: {
        total: activities,
        manual: manualActivities,
        events: activities - manualActivities,
      },
      incorporation,
    };
  }

  private dateRange(
    from?: string,
    to?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (from === undefined && to === undefined) return undefined;
    const gte = from === undefined ? undefined : new Date(from);
    const lte = to === undefined ? undefined : new Date(to);
    if (
      (gte && Number.isNaN(gte.getTime())) ||
      (lte && Number.isNaN(lte.getTime())) ||
      (gte && lte && gte > lte)
    )
      throw new BadRequestException('Invalid or inverted date range');
    return { gte, lte };
  }

  private async lockParticipation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    campaignId: string,
    prospectId: string,
  ): Promise<void> {
    // Serialize state + history changes before reading the previous value.
    // Lock only the participation; joined tenant checks preserve hidden 404s.
    const rows = await tx.$queryRaw<{ campaign_id: string }[]>`
      SELECT cp.campaign_id
      FROM campaign_prospects AS cp
      JOIN campaigns AS c ON c.id = cp.campaign_id
      JOIN prospects AS p ON p.id = cp.prospect_id
      WHERE cp.campaign_id = ${campaignId}
        AND cp.prospect_id = ${prospectId}
        AND c.tenant_id = ${tenantId}
        AND p.tenant_id = ${tenantId}
      FOR UPDATE OF cp
    `;
    if (rows.length === 0) {
      throw new NotFoundException('Participation not found');
    }
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025')
        throw new NotFoundException('Campaign not found');
      if (error.code === 'P2003')
        throw new ConflictException('Campaign has related records');
    }
    throw error;
  }
}
