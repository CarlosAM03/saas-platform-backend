import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProspectCsvParser } from './prospect-csv.parser';
import { ProspectImportsService } from './prospect-imports.service';

describe('ProspectImportsService', () => {
  const context = new TenantContextService();
  const owner = {
    userId: 'user',
    tenantId: 'tenant',
    tenantRole: 'OWNER' as const,
    platformRole: null,
  };
  let candidates: unknown[];
  let tx: {
    campaign: { findFirst: jest.Mock };
    prospect: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    campaignProspect: { upsert: jest.Mock };
  };
  let transaction: jest.Mock;
  let service: ProspectImportsService;
  const file = Buffer.from('name,email\nAlice,\nBob,bob@example.com');
  const run = <T>(fn: () => T) => context.run(owner, fn);
  const match = () => ({
    id: 'existing',
    name: 'Alice',
    category: null,
    address: null,
    phone: '001',
    email: 'old@example.com',
    website: null,
    language: null,
    status: 'ACTIVO',
    campaignId: 'other',
    updatedAt: new Date(0),
    campaignProspects: [],
  });

  beforeEach(() => {
    candidates = [];
    tx = {
      campaign: { findFirst: jest.fn().mockResolvedValue({ id: 'campaign' }) },
      prospect: {
        findMany: jest
          .fn()
          .mockImplementation(() => Promise.resolve(candidates)),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
        update: jest.fn().mockResolvedValue({}),
      },
      campaignProspect: { upsert: jest.fn().mockResolvedValue({}) },
    };
    transaction = jest
      .fn()
      .mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    service = new ProspectImportsService(
      { $transaction: transaction } as unknown as PrismaService,
      context,
      new ProspectCsvParser(),
      { getOrThrow: () => 'test-secret' } as unknown as ConfigService,
    );
  });

  it('preview does not write and confirm creates multiple prospects', async () => {
    await run(async () => {
      const preview = await service.preview('campaign', file);
      expect(tx.prospect.create).not.toHaveBeenCalled();
      const result = await service.confirm(
        'campaign',
        file,
        preview.previewReference,
        '[{"record":1,"action":"CREATE"},{"record":2,"action":"CREATE"}]',
      );
      expect(result.summary.created).toBe(2);
      expect(tx.campaignProspect.upsert).toHaveBeenCalledTimes(2);
      expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
        timeout: 30000,
      });
    });
  });
  it('LINK_EXISTING does not update attributes', async () => {
    candidates = [match()];
    await run(async () => {
      const preview = await service.preview('campaign', file);
      expect(preview.rows[0].matches[0].sharedWithOtherCampaigns).toBe(true);
      await service.confirm(
        'campaign',
        file,
        preview.previewReference,
        '[{"record":1,"action":"LINK_EXISTING"},{"record":2,"action":"SKIP"}]',
      );
      expect(tx.prospect.update).not.toHaveBeenCalled();
      expect(tx.prospect.create).not.toHaveBeenCalled();
    });
  });
  it('explicit UPDATE_EXISTING clears included nullable fields and preserves absent fields', async () => {
    candidates = [match()];
    await run(async () => {
      const preview = await service.preview('campaign', file);
      await service.confirm(
        'campaign',
        file,
        preview.previewReference,
        '[{"record":1,"action":"UPDATE_EXISTING"},{"record":2,"action":"SKIP"}]',
      );
      expect(tx.prospect.update).toHaveBeenCalledWith({
        where: { id: 'existing', tenantId: 'tenant' },
        data: { name: 'Alice', email: null },
      });
    });
  });
  it('rejects changed matches and repeated confirmation after changes', async () => {
    await run(async () => {
      const preview = await service.preview('campaign', file);
      candidates = [match()];
      await expect(
        service.confirm('campaign', file, preview.previewReference, '[]'),
      ).rejects.toThrow('new preview');
      expect(tx.prospect.create).not.toHaveBeenCalled();
    });
  });
  it('binds reference to file, tenant, user and campaign', async () => {
    const preview = await run(() => service.preview('campaign', file));
    await run(async () => {
      await expect(
        service.confirm(
          'campaign',
          Buffer.from('name\nChanged'),
          preview.previewReference,
          '[]',
        ),
      ).rejects.toThrow('reference');
      await expect(
        service.confirm('wrong', file, preview.previewReference, '[]'),
      ).rejects.toThrow('reference');
    });
    await context.run({ ...owner, tenantId: 'other' }, async () => {
      await expect(
        service.confirm('campaign', file, preview.previewReference, '[]'),
      ).rejects.toThrow('reference');
    });
    expect(tx.prospect.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant' } }),
    );
  });
  it('validates all decisions before writing', async () => {
    await run(async () => {
      const preview = await service.preview('campaign', file);
      await expect(
        service.confirm(
          'campaign',
          file,
          preview.previewReference,
          '[{"record":1,"action":"CREATE"},{"record":2,"action":"UPDATE_EXISTING"}]',
        ),
      ).rejects.toThrow('Invalid action');
      expect(tx.prospect.create).not.toHaveBeenCalled();
    });
  });
  it('retries only serialization conflicts with a maximum of three attempts', async () => {
    await run(async () => {
      const preview = await service.preview('campaign', file);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2034',
        clientVersion: '5',
      });
      transaction.mockRejectedValue(conflict);
      await expect(
        service.confirm('campaign', file, preview.previewReference, '[]'),
      ).rejects.toThrow('Concurrent import conflict');
      expect(transaction).toHaveBeenCalledTimes(4);
    });
  });
  it('propagates infrastructure failures rather than reporting invalid rows', async () => {
    await run(async () => {
      const preview = await service.preview('campaign', file);
      tx.campaignProspect.upsert.mockRejectedValue(
        new Error('database unavailable'),
      );
      await expect(
        service.confirm(
          'campaign',
          file,
          preview.previewReference,
          '[{"record":1,"action":"CREATE"},{"record":2,"action":"CREATE"}]',
        ),
      ).rejects.toThrow('database unavailable');
      expect(tx.prospect.create).toHaveBeenCalledTimes(1);
    });
  });
});
