import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/context/tenant-context.service';
import {
  PaginationDto,
  createPaginationMeta,
} from '../common/dto/pagination.dto';
import { UpdateProspectRequest } from './dto/update-prospect.request';
import { ProspectResponse } from './dto/prospect.response';
import { CreateProspectRequest } from './dto/create-prospect.request';
import { ResolveProspectRequest } from './dto/resolve-prospect.request';
import { ProspectHistoryQuery } from './dto/prospect-history.query';
import { createHash } from 'node:crypto';

// Campos que podemos devolver segÃºn el contrato de la API.
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

type SelectedProspect = Prisma.ProspectGetPayload<{
  select: typeof prospectSelect;
}>;

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(request: CreateProspectRequest): Promise<ProspectResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    const actorUserId = this.tenantContext.getRequiredContext().userId;
    const match = await this.match(request);
    if (match.strongProspect) {
      return this.linkExisting(
        tenantId,
        actorUserId,
        request.campaignId,
        match.strongProspect.id,
        request,
        true,
      );
    }
    if (match.candidates.length > 0) {
      throw this.matchConflict(match.candidates);
    }
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: request.campaignId, tenantId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const identity = this.identity(request);
    return this.createNew(
      tenantId,
      actorUserId,
      campaign.id,
      request,
      identity,
    );
  }

  async match(request: CreateProspectRequest) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.matchUsing(request, tenantId, this.prisma);
  }

  private async matchUsing(
    request: CreateProspectRequest,
    tenantId: string,
    client: Pick<Prisma.TransactionClient, 'campaign' | 'prospect'>,
  ) {
    const campaign = await client.campaign.findFirst({
      where: { id: request.campaignId, tenantId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const identity = this.identity(request);
    const prospects = await client.prospect.findMany({
      where: { tenantId },
      select: { ...prospectSelect, identitySource: true, identityHash: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    // The persisted original is authoritative: old hashes may have lowercased
    // identifiers. Never backfill them or infer equality from that hash alone.
    const hasExactOriginal = (prospect: (typeof prospects)[number]) =>
      prospect.source === identity?.source &&
      prospect.sourceIdentifier?.trim() === identity?.identifier;
    if (
      identity &&
      prospects.some(
        (prospect) =>
          prospect.identitySource === identity.source &&
          prospect.identityHash === identity.hash &&
          !hasExactOriginal(prospect),
      )
    ) {
      throw this.matchConflict(
        [],
        'Stored identity hash conflicts with the original identifier; manual review is required',
      );
    }
    const strongMatches = identity
      ? prospects.filter(
          (prospect) =>
            hasExactOriginal(prospect) &&
            (prospect.identitySource === identity.source ||
              (prospect.identitySource === null &&
                prospect.identityHash === null)),
        )
      : [];
    if (strongMatches.length > 1) {
      throw this.matchConflict(
        strongMatches.map((prospect) => this.toResponse(prospect)),
        'Multiple prospects share this identity; manual review is required',
      );
    }
    const strongProspect = strongMatches[0] ?? null;
    const normalized = this.normalizeName(request.name);
    const candidates = prospects
      .filter((prospect) => this.normalizeName(prospect.name) === normalized)
      .map((prospect) => this.toResponse(prospect));
    return {
      strongProspect: strongProspect ? this.toResponse(strongProspect) : null,
      candidates: strongProspect
        ? candidates.filter((candidate) => candidate.id !== strongProspect?.id)
        : candidates,
      resolutionRequired: Boolean(strongProspect || candidates.length),
    };
  }

  private matchConflict(
    candidates: ProspectResponse[],
    message = 'Prospect matches require an explicit decision',
  ): ConflictException {
    return new ConflictException({
      message,
      details: { reason: 'PROSPECT_MATCH_REQUIRES_DECISION', candidates },
    });
  }

  async resolve(request: ResolveProspectRequest) {
    const tenantId = this.tenantContext.requireTenantId();
    const actorUserId = this.tenantContext.getRequiredContext().userId;
    if (request.resolution === 'SKIP') {
      return { action: 'SKIP' as const };
    }
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: request.campaignId, tenantId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (request.resolution === 'LINK_EXISTING') {
      if (!request.candidateId) {
        throw new BadRequestException('candidateId is required');
      }
      const prospect = await this.linkExisting(
        tenantId,
        actorUserId,
        campaign.id,
        request.candidateId,
        request,
      );
      return { action: 'LINK_EXISTING' as const, prospect };
    }
    const identity = this.identity(request);
    const prospect = await this.createNew(
      tenantId,
      actorUserId,
      campaign.id,
      request,
      identity,
      true,
    );
    return { action: 'CREATE' as const, prospect };
  }

  async campaignsForProspect(
    prospectId: string,
    query: ProspectHistoryQuery = new ProspectHistoryQuery(),
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.$transaction(
      async (tx) => {
        const prospect = await tx.prospect.findFirst({
          where: { id: prospectId, tenantId },
          select: {
            id: true,
            campaignId: true,
          },
        });
        if (!prospect) throw new NotFoundException('Prospect not found');
        const where: Prisma.CampaignProspectWhereInput = {
          prospectId,
          campaign: { tenantId },
          prospect: { tenantId },
        };
        const participations = await tx.campaignProspect.findMany({
          where,
          include: {
            campaign: {
              select: { id: true, name: true, status: true },
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
            activities: {
              where: { tenantId },
              orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: { id: true, type: true, content: true, recordedAt: true },
            },
          },
          orderBy: [{ addedAt: 'desc' }, { campaignId: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const total = await tx.campaignProspect.count({ where });
        return {
          originCampaignId: prospect.campaignId,
          campaigns: participations.map((participation) => ({
            campaign: participation.campaign,
            isOrigin: participation.campaignId === prospect.campaignId,
            stage: participation.commercialStage,
            evaluation: participation.evaluation,
            responsible: participation.responsible
              ? {
                  id: participation.responsible.id,
                  name: participation.responsible.name,
                  status: participation.responsible.status,
                  eligible:
                    participation.responsible.status === 'ACTIVO' &&
                    participation.responsible.userTenants.length > 0,
                }
              : null,
            latestActivity: participation.activities[0] ?? null,
            addedAt: participation.addedAt,
          })),
          meta: createPaginationMeta(query.page, query.limit, total),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async provenance(
    prospectId: string,
    query: ProspectHistoryQuery = new ProspectHistoryQuery(),
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.$transaction(
      async (tx) => {
        const prospect = await tx.prospect.findFirst({
          where: { id: prospectId, tenantId },
          select: { id: true },
        });
        if (!prospect) throw new NotFoundException('Prospect not found');
        const events = await tx.prospectProvenance.findMany({
          where: { tenantId, prospectId },
          include: {
            actor: { select: { id: true, name: true } },
          },
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const total = await tx.prospectProvenance.count({
          where: { tenantId, prospectId },
        });
        return {
          data: events,
          meta: createPaginationMeta(query.page, query.limit, total),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private identity(
    request: CreateProspectRequest,
  ): { source: 'google_maps'; identifier: string; hash: string } | null {
    if (!request.identitySource || !request.identityIdentifier) return null;
    const identifier = request.identityIdentifier.trim();
    if (!identifier) return null;
    return {
      source: request.identitySource,
      identifier,
      hash: createHash('sha256')
        .update(`${request.identitySource}:${identifier}`)
        .digest('hex'),
    };
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  }

  private async linkExisting(
    tenantId: string,
    actorUserId: string,
    campaignId: string,
    prospectId: string,
    request: CreateProspectRequest,
    requireStrong = false,
  ): Promise<ProspectResponse> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const match = await this.matchUsing(request, tenantId, tx);
          const eligible =
            match.strongProspect?.id === prospectId ||
            (!requireStrong &&
              match.candidates.some(
                (candidate) => candidate.id === prospectId,
              ));
          if (!eligible) {
            throw new ConflictException(
              'Candidate changed; request prospect matches again',
            );
          }
          const prospect = await tx.prospect.findFirst({
            where: { id: prospectId, tenantId },
            select: prospectSelect,
          });
          if (!prospect) throw new NotFoundException('Prospect not found');
          const campaign = await tx.campaign.findFirst({
            where: { id: campaignId, tenantId },
            select: { id: true },
          });
          if (!campaign) throw new NotFoundException('Campaign not found');
          const existing =
            typeof tx.campaignProspect.findFirst === 'function'
              ? await tx.campaignProspect.findFirst({
                  where: { campaignId, prospectId },
                  select: { campaignId: true },
                })
              : null;
          await tx.campaignProspect.upsert({
            where: {
              campaignId_prospectId: { campaignId, prospectId },
            },
            create: { campaignId, prospectId },
            update: {},
          });
          await tx.prospectProvenance.create({
            data: {
              tenantId,
              prospectId,
              campaignId,
              type: existing ? 'REAPPEARED' : 'LINKED',
              source: 'manual',
              actorUserId,
            },
          });
          if (!existing) {
            await tx.campaignActivity.create({
              data: {
                tenantId,
                campaignId,
                prospectId,
                type: 'ASSOCIATION',
                actorUserId,
              },
            });
          }
          return this.toResponse(prospect);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'Prospect identity changed concurrently; request matches again',
        );
      }
      throw error;
    }
  }

  private async createNew(
    tenantId: string,
    actorUserId: string,
    campaignId: string,
    request: CreateProspectRequest,
    identity: {
      source: 'google_maps';
      identifier: string;
      hash: string;
    } | null,
    consciousCreate = false,
  ): Promise<ProspectResponse> {
    const metadata = this.prepareMetadata(request.metadata);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const campaign = await tx.campaign.findFirst({
            where: { id: campaignId, tenantId },
            select: { id: true },
          });
          if (!campaign) throw new NotFoundException('Campaign not found');
          const match = await this.matchUsing(request, tenantId, tx);
          if (match.strongProspect) {
            throw this.matchConflict(
              [match.strongProspect, ...match.candidates],
              'Prospect identity already exists; request matches again',
            );
          }
          if (!consciousCreate && match.candidates.length > 0) {
            throw this.matchConflict(match.candidates);
          }
          const prospect = await tx.prospect.create({
            data: {
              tenantId,
              campaignId,
              name: request.name,
              category: request.category,
              address: request.address,
              phone: request.phone,
              email: request.email,
              website: request.website,
              language: request.language,
              status: request.status,
              metadata,
              source: identity ? 'google_maps' : 'manual',
              sourceIdentifier: identity?.identifier ?? null,
              identitySource: identity?.source ?? null,
              identityHash: identity?.hash ?? null,
            },
            select: prospectSelect,
          });
          await tx.campaignProspect.create({
            data: { campaignId, prospectId: prospect.id },
          });
          await tx.prospectProvenance.create({
            data: {
              tenantId,
              prospectId: prospect.id,
              campaignId,
              type: 'CREATED',
              source: identity ? 'google_maps' : 'manual',
              actorUserId,
              ...(consciousCreate
                ? {
                    details: {
                      resolution: 'CREATE',
                      candidateIds: match.candidates.map(
                        (candidate) => candidate.id,
                      ),
                    },
                  }
                : {}),
            },
          });
          await tx.campaignActivity.create({
            data: {
              tenantId,
              campaignId,
              prospectId: prospect.id,
              type: 'ASSOCIATION',
              actorUserId,
            },
          });
          return this.toResponse(prospect);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'Prospect identity changed concurrently; request matches again',
        );
      }
      throw error;
    }
  }

  async findAll(query: PaginationDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const search = query.search?.trim();

    const where: Prisma.ProspectWhereInput = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [prospects, total] = await this.prisma.$transaction([
      this.prisma.prospect.findMany({
        where,
        select: prospectSelect,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.prospect.count({ where }),
    ]);

    return {
      data: prospects.map((prospect) => this.toResponse(prospect)),
      meta: createPaginationMeta(query.page, query.limit, total),
    };
  }

  async findOne(id: string): Promise<ProspectResponse> {
    const tenantId = this.tenantContext.requireTenantId();

    const prospect = await this.prisma.prospect.findFirst({
      where: { id, tenantId },
      select: prospectSelect,
    });

    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    return this.toResponse(prospect);
  }

  async update(
    id: string,
    request: UpdateProspectRequest,
  ): Promise<ProspectResponse> {
    const tenantId = this.tenantContext.requireTenantId();
    const actorUserId = this.tenantContext.getRequiredContext().userId;

    const fields = [
      'name',
      'category',
      'address',
      'phone',
      'email',
      'website',
      'language',
      'status',
      'metadata',
    ] as const;
    if (fields.every((field) => request[field] === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    if (
      request.contextCampaignId !== undefined &&
      (typeof request.contextCampaignId !== 'string' ||
        !request.contextCampaignId.trim() ||
        request.contextCampaignId.length > 128)
    ) {
      throw new BadRequestException('Invalid contextCampaignId');
    }

    const metadata = this.prepareMetadata(request.metadata);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (request.contextCampaignId !== undefined) {
            const participation = await tx.campaignProspect.findFirst({
              where: {
                prospectId: id,
                campaignId: request.contextCampaignId,
                prospect: { tenantId },
                campaign: { tenantId },
              },
              select: { campaignId: true },
            });
            if (!participation)
              throw new NotFoundException('Participation not found');
          }
          const prospect = await tx.prospect.update({
            where: { id, tenantId },
            select: prospectSelect,
            data: {
              name: request.name,
              category: request.category,
              address: request.address,
              phone: request.phone,
              email: request.email,
              website: request.website,
              language: request.language,
              status: request.status,
              metadata,
            },
          });
          await tx.prospectProvenance.create({
            data: {
              tenantId,
              prospectId: prospect.id,
              campaignId: request.contextCampaignId ?? prospect.campaignId,
              type: 'MASTER_UPDATED',
              source: 'manual',
              actorUserId,
            },
          });
          return this.toResponse(prospect);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Prospect context changed concurrently; retry the update',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Prospect not found');
      }

      throw error;
    }
  }

  private toResponse(prospect: SelectedProspect): ProspectResponse {
    if (
      prospect.source !== 'google_maps' &&
      prospect.source !== 'manual' &&
      prospect.source !== 'csv'
    ) {
      throw new InternalServerErrorException(
        'Unsupported prospect source in stored data',
      );
    }

    const metadata = prospect.metadata;

    if (
      metadata !== null &&
      (typeof metadata !== 'object' || Array.isArray(metadata))
    ) {
      throw new InternalServerErrorException(
        'Invalid metadata in stored prospect',
      );
    }

    return {
      id: prospect.id,
      campaignId: prospect.campaignId,
      name: prospect.name,
      category: prospect.category,
      address: prospect.address,
      phone: prospect.phone,
      email: prospect.email,
      website: prospect.website,
      source: prospect.source,
      sourceIdentifier: prospect.sourceIdentifier,
      language: prospect.language,
      status: prospect.status,
      metadata,
      createdAt: prospect.createdAt,
      updatedAt: prospect.updatedAt,
    };
  }

  private prepareMetadata(
    value: Record<string, unknown> | null | undefined,
  ): Prisma.InputJsonObject | typeof Prisma.DbNull | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.DbNull;
    }

    if (!this.isJsonObject(value)) {
      throw new BadRequestException('Metadata must be a valid JSON object');
    }

    return value;
  }

  private isJsonObject(value: unknown): value is Prisma.InputJsonObject {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.values(value).every((item: unknown) => this.isJsonValue(item))
    );
  }

  private isJsonValue(value: unknown): boolean {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    ) {
      return true;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
      return value.every((item: unknown) => this.isJsonValue(item));
    }

    return this.isJsonObject(value);
  }
}
