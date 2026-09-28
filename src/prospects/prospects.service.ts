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
import type { BusinessResult } from '../prospector-client/dto/job-event.request';

// Campos que podemos devolver según el contrato de la API.
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

  async persistResults(campaignId: string, results: BusinessResult[]) {
    const tenantId = this.tenantContext.requireTenantId();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const campaign = await transaction.campaign.findFirst({
              where: { id: campaignId, tenantId },
            });
            if (!campaign) throw new NotFoundException('Campaign not found');
            let persisted = 0;
            let skipped = 0;
            for (const result of results) {
              // NULL does not participate in PostgreSQL unique constraints. Use
              // exact business/contact identity for those results, within the
              // same tenant/campaign; SERIALIZABLE protects concurrent batches.
              const where: Prisma.ProspectWhereInput = {
                tenantId,
                campaignId,
                source: result.source,
                sourceIdentifier: result.sourceIdentifier ?? null,
                ...(result.sourceIdentifier == null
                  ? {
                      name: result.name,
                      address: result.address ?? null,
                      phone: result.phone ?? null,
                      email: result.email ?? null,
                      website: result.website ?? null,
                    }
                  : {}),
              };
              let prospect = await transaction.prospect.findFirst({ where });
              if (prospect) skipped++;
              else {
                prospect = await transaction.prospect.create({
                  data: {
                    tenantId,
                    campaignId,
                    name: result.name,
                    source: result.source,
                    sourceIdentifier: result.sourceIdentifier,
                    category: result.category,
                    address: result.address,
                    phone: result.phone,
                    email: result.email,
                    website: result.website,
                    language: result.language,
                    metadata: this.prepareMetadata(result.metadata),
                  },
                });
                persisted++;
              }
              await transaction.campaignProspect.upsert({
                where: {
                  campaignId_prospectId: {
                    campaignId,
                    prospectId: prospect.id,
                  },
                },
                create: { campaignId, prospectId: prospect.id },
                update: {},
              });
            }
            return { persisted, skipped };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          !['P2034', 'P2002'].includes(error.code)
        )
          throw error;
        if (attempt === 2)
          throw new ConflictException(
            'Concurrent persistence; retry the request',
          );
      }
    }
    throw new ConflictException('Unable to persist results');
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

    if (Object.values(request).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }

    const metadata = this.prepareMetadata(request.metadata);

    try {
      const prospect = await this.prisma.prospect.update({
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

      return this.toResponse(prospect);
    } catch (error) {
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
    if (prospect.source !== 'google_maps') {
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
