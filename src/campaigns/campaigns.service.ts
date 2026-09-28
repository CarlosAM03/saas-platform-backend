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

  async findProspects(id: string, query: PaginationDto) {
    const tenantId = this.context.requireTenantId();
    await this.findOne(id);
    const where: Prisma.ProspectWhereInput = {
      tenantId,
      AND: [
        {
          OR: [
            { campaignId: id },
            {
              campaignProspects: {
                some: { campaignId: id, campaign: { tenantId } },
              },
            },
          ],
        },
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
        select: prospectSelect,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.prospect.count({ where }),
    ]);
    return { data, meta: createPaginationMeta(query.page, query.limit, total) };
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
