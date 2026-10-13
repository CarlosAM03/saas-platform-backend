import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import {
  CSV_FIELDS,
  ImportRow,
  normalizeName,
  ProspectCsvParser,
} from './prospect-csv.parser';

type Action = 'CREATE' | 'LINK_EXISTING' | 'UPDATE_EXISTING' | 'SKIP';
interface Decision {
  record: number;
  action: Action;
}
const candidateSelect = {
  id: true,
  name: true,
  category: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  language: true,
  status: true,
  campaignId: true,
  updatedAt: true,
  campaignProspects: {
    where: { campaign: {} },
    select: { campaignId: true, status: true },
    orderBy: { campaignId: 'asc' as const },
  },
} satisfies Prisma.ProspectSelect;
type Candidate = Prisma.ProspectGetPayload<{ select: typeof candidateSelect }>;
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class ProspectImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: TenantContextService,
    private readonly parser: ProspectCsvParser,
    private readonly config: ConfigService,
  ) {}

  async preview(campaignId: string, file: Buffer) {
    const tenantId = this.context.requireTenantId();
    const rows = this.parser.parse(file);
    const state = await this.prisma.$transaction(
      (tx) => this.readState(tx, tenantId, campaignId, rows),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (
      Buffer.byteLength(JSON.stringify(state.rows), 'utf8') >
      5 * 1024 * 1024
    ) {
      throw new BadRequestException(
        'Preview exceeds 5 MB; split the CSV into smaller files',
      );
    }
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const payload = Buffer.from(
      JSON.stringify({
        version: 1,
        userId: this.context.getRequiredContext().userId,
        tenantId,
        campaignId,
        fileHash: hash(file),
        snapshot: state.snapshot,
        expiresAt,
      }),
    ).toString('base64url');
    return {
      previewReference: `${payload}.${this.sign(payload)}`,
      expiresAt: new Date(expiresAt).toISOString(),
      summary: this.summary(state.rows),
      rows: state.rows,
    };
  }

  async confirm(
    campaignId: string,
    file: Buffer,
    reference: string,
    rawDecisions: string,
  ) {
    const tenantId = this.context.requireTenantId();
    const rows = this.parser.parse(file);
    const snapshot = this.verify(reference, tenantId, campaignId, file);
    const decisions = this.decisions(rawDecisions);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const state = await this.readState(tx, tenantId, campaignId, rows);
            if (state.snapshot !== snapshot)
              throw new ConflictException(
                'Prospects changed; request a new preview',
              );
            const applicable = state.rows.filter(
              (row) =>
                row.classification !== 'INVALID' &&
                row.classification !== 'CONFLICT',
            );
            if (
              decisions.size !== applicable.length ||
              applicable.some((row) => !decisions.has(row.record))
            ) {
              throw new BadRequestException(
                'Exactly one decision is required for each actionable record',
              );
            }
            // Validate the entire decision set before issuing any write.
            for (const row of applicable) {
              const action = decisions.get(row.record)!;
              const allowed: Action[] =
                row.classification === 'NEW'
                  ? ['CREATE', 'SKIP']
                  : ['LINK_EXISTING', 'UPDATE_EXISTING', 'SKIP'];
              if (!allowed.includes(action))
                throw new BadRequestException(
                  `Invalid action for record ${row.record}`,
                );
            }
            const result: {
              record: number;
              action: Action | 'REJECTED';
              prospectId?: string;
              errors?: ImportRow['errors'];
            }[] = [];
            for (const row of state.rows) {
              if (
                row.classification === 'INVALID' ||
                row.classification === 'CONFLICT'
              ) {
                result.push({
                  record: row.record,
                  action: 'REJECTED',
                  errors: row.errors,
                });
                continue;
              }
              const action = decisions.get(row.record)!;
              if (action === 'SKIP') {
                result.push({ record: row.record, action });
                continue;
              }
              let prospectId = row.matches[0]?.id;
              if (action === 'CREATE') {
                const created = await tx.prospect.create({
                  data: {
                    ...row.values,
                    tenantId,
                    campaignId,
                    source: 'csv',
                    sourceIdentifier: null,
                  },
                  select: { id: true },
                });
                prospectId = created.id;
              } else if (action === 'UPDATE_EXISTING') {
                await tx.prospect.update({
                  where: { id: prospectId, tenantId },
                  data: row.values,
                });
              }
              await tx.campaignProspect.upsert({
                where: {
                  campaignId_prospectId: {
                    campaignId,
                    prospectId: prospectId,
                  },
                },
                create: { campaignId, prospectId: prospectId },
                update: {},
              });
              result.push({ record: row.record, action, prospectId });
            }
            return {
              summary: {
                total: result.length,
                created: result.filter((r) => r.action === 'CREATE').length,
                linked: result.filter((r) => r.action === 'LINK_EXISTING')
                  .length,
                updated: result.filter((r) => r.action === 'UPDATE_EXISTING')
                  .length,
                skipped: result.filter((r) => r.action === 'SKIP').length,
                rejected: result.filter((r) => r.action === 'REJECTED').length,
              },
              rows: result,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 30000,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'Concurrent import conflict; request a new preview',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('Import conflict');
  }

  private async readState(
    tx: Prisma.TransactionClient,
    tenantId: string,
    campaignId: string,
    rows: ImportRow[],
  ) {
    const campaign = await tx.campaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const names = new Set(
      rows
        .filter((r) => !r.errors.length)
        .map((r) => normalizeName(r.values.name)),
    );
    // V1 has no normalized-name column: scan tenant candidates without changing baseline identity.
    const all = await tx.prospect.findMany({
      where: { tenantId },
      select: {
        ...candidateSelect,
        campaignProspects: {
          ...candidateSelect.campaignProspects,
          where: { campaign: { tenantId } },
        },
      },
      orderBy: { id: 'asc' },
    });
    const candidates = all.filter((p) => names.has(normalizeName(p.name)));
    const classified = rows.map((row) => {
      const matches = row.errors.length
        ? []
        : candidates.filter(
            (p) => normalizeName(p.name) === normalizeName(row.values.name),
          );
      const classification = row.errors.length
        ? 'INVALID'
        : matches.length > 1
          ? 'CONFLICT'
          : matches.length
            ? 'MATCH'
            : 'NEW';
      return {
        ...row,
        classification,
        errors:
          matches.length > 1
            ? [
                {
                  field: 'name',
                  message: 'Multiple existing candidates; correct this record',
                },
              ]
            : row.errors,
        matches: matches.map((p: Candidate) => ({
          id: p.id,
          campaignIds: [
            ...new Set([
              p.campaignId,
              ...p.campaignProspects.map((c) => c.campaignId),
            ]),
          ],
          sharedWithOtherCampaigns:
            p.campaignId !== campaignId ||
            p.campaignProspects.some((c) => c.campaignId !== campaignId),
          differences: CSV_FIELDS.filter(
            (field) =>
              Object.hasOwn(row.values, field) &&
              row.values[field] !== p[field],
          ).map((field) => ({
            field,
            existing: p[field],
            imported: row.values[field],
          })),
        })),
      };
    });
    return { rows: classified, snapshot: hash(JSON.stringify(candidates)) };
  }

  private summary(rows: { classification: string }[]) {
    return {
      total: rows.length,
      new: rows.filter((r) => r.classification === 'NEW').length,
      matches: rows.filter((r) => r.classification === 'MATCH').length,
      invalid: rows.filter((r) => r.classification === 'INVALID').length,
      conflicts: rows.filter((r) => r.classification === 'CONFLICT').length,
    };
  }

  private sign(payload: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update('prospect-csv-preview-v1:')
      .update(payload)
      .digest('base64url');
  }

  private verify(
    reference: string,
    tenantId: string,
    campaignId: string,
    file: Buffer,
  ): string {
    try {
      const [payload, signature, extra] = reference.split('.');
      if (!payload || !signature || extra !== undefined) throw new Error();
      const expected = Buffer.from(this.sign(payload));
      const actual = Buffer.from(signature);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        throw new Error();
      const data = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
      if (
        data.version !== 1 ||
        data.tenantId !== tenantId ||
        data.campaignId !== campaignId ||
        data.userId !== this.context.getRequiredContext().userId ||
        data.fileHash !== hash(file) ||
        typeof data.expiresAt !== 'number' ||
        data.expiresAt <= Date.now() ||
        typeof data.snapshot !== 'string'
      )
        throw new Error();
      return data.snapshot;
    } catch {
      throw new BadRequestException(
        'Invalid or expired preview reference; request a new preview',
      );
    }
  }

  private decisions(raw: string): Map<number, Action> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Decisions must be a JSON array');
    }
    if (!Array.isArray(parsed) || parsed.length > 1000)
      throw new BadRequestException('Invalid decisions');
    const result = new Map<number, Action>();
    for (const item of parsed as unknown[]) {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new BadRequestException('Invalid decision');
      const d = item as Decision;
      if (
        Object.keys(d).length !== 2 ||
        !Number.isInteger(d.record) ||
        d.record < 1 ||
        !['CREATE', 'LINK_EXISTING', 'UPDATE_EXISTING', 'SKIP'].includes(
          d.action,
        ) ||
        result.has(d.record)
      ) {
        throw new BadRequestException('Invalid or repeated decision');
      }
      result.set(d.record, d.action);
    }
    return result;
  }
}
