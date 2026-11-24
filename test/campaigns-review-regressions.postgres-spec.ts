import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { CampaignsService } from '../src/campaigns/campaigns.service';
import { ProspectsService } from '../src/prospects/prospects.service';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('CP review regressions on disposable PostgreSQL', () => {
  let db: PrismaService;
  let tenantId: string;
  let actor: string;
  let secondUser: string;
  let campaignId: string;
  let otherCampaignId: string;
  let prospectId: string;
  const context = new TenantContextService();

  const run = <T>(fn: () => T) =>
    context.run(
      {
        tenantId,
        userId: actor,
        tenantRole: 'OWNER',
        platformRole: null,
      },
      fn,
    );

  const service = () => new CampaignsService(db, context);
  const prospects = () => new ProspectsService(db, context);
  const participationWhere = () => ({
    campaignId_prospectId: { campaignId, prospectId },
  });

  beforeAll(async () => {
    if (!process.env.INTEGRATION_TEST_DATABASE_URL) {
      throw new Error('Disposable PostgreSQL required');
    }
    db = new PrismaService();
    await db.$connect();
  });

  beforeEach(async () => {
    tenantId = (
      await db.tenant.create({
        data: {
          name: 'Synthetic review tenant',
          slug: `cp-review-${randomUUID()}`,
        },
      })
    ).id;

    const role = await db.role.create({
      data: { tenantId, name: 'OWNER' },
    });
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({
        data: {
          name: `Synthetic user ${i}`,
          email: `${randomUUID()}@synthetic.test`,
          passwordHash: 'not-used',
        },
      });
      ids.push(user.id);
      await db.userTenant.create({
        data: { tenantId, userId: user.id, roleId: role.id },
      });
    }
    [actor, secondUser] = ids;

    const campaignIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      campaignIds.push(
        (
          await db.campaign.create({
            data: {
              tenantId,
              createdBy: actor,
              name: `Synthetic campaign ${i}`,
            },
          })
        ).id,
      );
    }
    [campaignId, otherCampaignId] = campaignIds;

    // Legacy fixture: participation exists but has no provenance.
    prospectId = (
      await db.prospect.create({
        data: {
          tenantId,
          campaignId,
          name: 'Synthetic legacy prospect',
          source: 'manual',
        },
      })
    ).id;
    await db.campaignProspect.create({
      data: { campaignId, prospectId },
    });
  });

  afterEach(async () => {
    if (!tenantId) return;
    const where = { tenantId };
    await db.campaignActivity.deleteMany({ where });
    await db.prospectProvenance.deleteMany({ where });
    await db.campaignProspect.deleteMany({
      where: { campaign: { tenantId } },
    });
    await db.prospect.deleteMany({ where });
    await db.campaign.deleteMany({ where });
    await db.userTenant.deleteMany({ where });
    await db.role.deleteMany({ where });
    await db.tenant.delete({ where: { id: tenantId } });
    await db.user.deleteMany({
      where: { id: { in: [actor, secondUser] } },
    });
  });

  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  const revocations = ['status', 'membership'] as const;
  type Revocation = (typeof revocations)[number];

  async function revoke(tx: Prisma.TransactionClient, kind: Revocation) {
    if (kind === 'status') {
      await tx.user.update({
        where: { id: secondUser },
        data: { status: 'INACTIVO' },
      });
    } else {
      await tx.userTenant.delete({
        where: { userId_tenantId: { userId: secondUser, tenantId } },
      });
    }
  }

  function hold(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const ready = deferred();
    const release = deferred();
    const transaction = db.$transaction(
      async (tx) => {
        await write(tx);
        ready.resolve();
        await release.promise;
      },
      { timeout: 15000 },
    );
    return {
      ready: Promise.race([ready.promise, transaction]),
      release,
      transaction,
    };
  }

  async function tag(tx: Prisma.TransactionClient, label: string) {
    await tx.$queryRaw`SELECT set_config('application_name', ${label}, true)`;
  }

  function assignment(label: string) {
    const tagged = {
      $transaction: (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: { isolationLevel: Prisma.TransactionIsolationLevel },
      ) =>
        db.$transaction(async (tx) => {
          await tag(tx, label);
          return callback(tx);
        }, options),
    } as unknown as PrismaService;
    const svc = new CampaignsService(tagged, context);
    return run(() => svc.assignResponsible(campaignId, prospectId, secondUser));
  }

  async function waitForLock(label: string, operation: Promise<unknown>) {
    const finished = operation.then(
      () => 'finished',
      () => 'finished',
    );
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const [row] = await db.$queryRaw<{ waiting: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE application_name = ${label}
            AND datname = current_database()
            AND cardinality(pg_blocking_pids(pid)) > 0
        ) AS waiting
      `;
      if (row.waiting) return 'blocked';
      const result = await Promise.race([
        finished,
        new Promise<undefined>((done) => setTimeout(done, 10)),
      ]);
      if (result) return result;
    }
    return 'unobserved';
  }

  const responsibilityEvents = () =>
    db.campaignActivity.findMany({
      where: { tenantId, campaignId, prospectId, type: 'RESPONSIBLE_CHANGE' },
      select: { previousValue: true, newValue: true, actorUserId: true },
    });

  it.each(revocations)(
    'CP-02: %s revocation before assignment rejects without writes',
    async (kind) => {
      const blocker = hold((tx) => revoke(tx, kind));
      try {
        await blocker.ready;
        const label = `cp02-${randomUUID()}`;
        const write = assignment(label);
        const checks = Promise.allSettled([write]);
        try {
          expect(await waitForLock(label, write)).toBe('blocked');
          blocker.release.resolve();
          await blocker.transaction;
          await expect(write).rejects.toBeInstanceOf(BadRequestException);
          expect(
            await db.campaignProspect.findUniqueOrThrow({
              where: participationWhere(),
            }),
          ).toMatchObject({ responsibleId: null });
          expect(await responsibilityEvents()).toEqual([]);
        } finally {
          blocker.release.resolve();
          await checks;
        }
      } finally {
        blocker.release.resolve();
        await Promise.allSettled([blocker.transaction]);
      }
    },
  );

  it.each(revocations)(
    'CP-02: assignment commits before %s revocation and preserves history',
    async (kind) => {
      // Pause the real assignment at its activity insert, after the eligibility read.
      const blocker = hold(
        (tx) => tx.$executeRaw`LOCK TABLE campaign_activities IN SHARE MODE`,
      );
      try {
        await blocker.ready;
        const writer = `cp02-${randomUUID()}`;
        const write = assignment(writer);
        const writes = Promise.allSettled([write]);
        try {
          expect(await waitForLock(writer, write)).toBe('blocked');
          const revoker = `cp02-${randomUUID()}`;
          const revoked = db.$transaction(async (tx) => {
            await tag(tx, revoker);
            await revoke(tx, kind);
          });
          const outcomes = Promise.allSettled([revoked]);
          try {
            expect(await waitForLock(revoker, revoked)).toBe('blocked');
            blocker.release.resolve();
            await blocker.transaction;
            await expect(write).resolves.toMatchObject({
              responsibleId: secondUser,
              responsible: { eligible: true },
            });
            await revoked;
            const current = await run(() =>
              service().getParticipation(campaignId, prospectId),
            );
            expect(current).toMatchObject({
              responsibleId: secondUser,
              responsible: { eligible: false },
            });
            expect(await responsibilityEvents()).toEqual([
              { previousValue: null, newValue: secondUser, actorUserId: actor },
            ]);
          } finally {
            blocker.release.resolve();
            await outcomes;
          }
        } finally {
          blocker.release.resolve();
          await writes;
        }
      } finally {
        blocker.release.resolve();
        await Promise.allSettled([blocker.transaction]);
      }
    },
  );

  it('CP-02: lock timeout rolls back assignment and permits a clean retry', async () => {
    const blocker = hold(
      (tx) => tx.$executeRaw`LOCK TABLE campaign_activities IN SHARE MODE`,
    );
    try {
      await blocker.ready;
      const label = `cp02-${randomUUID()}`;
      const write = assignment(label);
      const checks = Promise.allSettled([write]);
      try {
        expect(await waitForLock(label, write)).toBe('blocked');
        await expect(write).rejects.toThrow(/lock timeout/i);
        expect(
          await db.campaignProspect.findUniqueOrThrow({
            where: participationWhere(),
          }),
        ).toMatchObject({ responsibleId: null });
        expect(await responsibilityEvents()).toEqual([]);
      } finally {
        blocker.release.resolve();
        await checks;
      }
      await blocker.transaction;
      await expect(
        run(() =>
          service().assignResponsible(campaignId, prospectId, secondUser),
        ),
      ).resolves.toMatchObject({ responsibleId: secondUser });
      expect(await responsibilityEvents()).toEqual([
        { previousValue: null, newValue: secondUser, actorUserId: actor },
      ]);
    } finally {
      blocker.release.resolve();
      await Promise.allSettled([blocker.transaction]);
    }
  }, 10000);

  it('CP-02: removing the same user from another tenant does not block assignment', async () => {
    const foreign = await db.tenant.create({
      data: {
        name: 'Synthetic foreign tenant',
        slug: `cp02-foreign-${randomUUID()}`,
      },
    });
    try {
      const role = await db.role.create({
        data: { tenantId: foreign.id, name: 'MEMBER' },
      });
      const membership = { userId: secondUser, tenantId: foreign.id };
      await db.userTenant.create({ data: { ...membership, roleId: role.id } });
      const blocker = hold((tx) =>
        tx.userTenant.delete({ where: { userId_tenantId: membership } }),
      );
      try {
        await blocker.ready;
        const label = `cp02-${randomUUID()}`;
        const write = assignment(label);
        const checks = Promise.allSettled([write]);
        try {
          expect(await waitForLock(label, write)).toBe('finished');
          await expect(write).resolves.toMatchObject({
            responsibleId: secondUser,
            responsible: { eligible: true },
          });
        } finally {
          blocker.release.resolve();
          await checks;
        }
        await blocker.transaction;
        expect(await responsibilityEvents()).toEqual([
          { previousValue: null, newValue: secondUser, actorUserId: actor },
        ]);
      } finally {
        blocker.release.resolve();
        await Promise.allSettled([blocker.transaction]);
      }
    } finally {
      await db.userTenant.deleteMany({ where: { tenantId: foreign.id } });
      await db.role.deleteMany({ where: { tenantId: foreign.id } });
      await db.tenant.delete({ where: { id: foreign.id } });
    }
  });

  /**
   * Requires >= 4 pool connections:
   * blocker, two writers, observer.
   * All queries and writes execute against real PostgreSQL.
   */
  async function overlap(
    write: (svc: CampaignsService, index: number) => Promise<unknown>,
  ) {
    const ready = deferred();
    const release = deferred();
    const applicationName = `cp-review-${randomUUID()}`;
    const writes: Promise<unknown>[] = [];

    const holder = db.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT campaign_id
          FROM campaign_prospects
          WHERE campaign_id = ${campaignId}
            AND prospect_id = ${prospectId}
          FOR UPDATE
        `;
        ready.resolve();
        await release.promise;
      },
      { timeout: 15000, maxWait: 5000 },
    );

    // Only annotate actual writer transactions; do not replace SQL behavior.
    const tagged = {
      $transaction: (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      ) =>
        db.$transaction(
          async (tx) => {
            await tx.$queryRaw`
              SELECT set_config('application_name', ${applicationName}, true)
            `;
            return callback(tx);
          },
          { timeout: 15000, maxWait: 5000 },
        ),
    } as unknown as PrismaService;

    try {
      await Promise.race([
        ready.promise,
        holder.then(() => {
          throw new Error('Blocker ended before the barrier was ready');
        }),
      ]);

      const svc = new CampaignsService(tagged, context);
      writes.push(
        run(() => write(svc, 0)),
        run(() => write(svc, 1)),
      );

      // Attach rejection handlers immediately while observing lock waits.
      const settled = Promise.allSettled(writes);
      const deadline = Date.now() + 7000;
      let waiting = 0;
      while (Date.now() < deadline) {
        const rows = await db.$queryRaw<{ waiting: number }[]>`
          SELECT count(*)::int AS waiting
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND application_name = ${applicationName}
            AND state = 'active'
            AND wait_event_type = 'Lock'
            AND cardinality(pg_blocking_pids(pid)) > 0
        `;
        waiting = rows[0].waiting;
        if (waiting === 2) break;
        await new Promise<void>((done) => setTimeout(done, 20));
      }

      expect(waiting).toBe(2);
      release.resolve();
      await holder;

      const results = await settled;
      expect(results.map((result) => result.status)).toEqual([
        'fulfilled',
        'fulfilled',
      ]);
    } finally {
      release.resolve();
      await Promise.allSettled([holder, ...writes]);
    }
  }

  const dimensions = ['stage', 'evaluation', 'responsible'] as const;
  type Dimension = (typeof dimensions)[number];

  function values(dimension: Dimension) {
    if (dimension === 'stage') {
      return {
        initial: 'SIN_GESTIONAR',
        next: ['CONTACTADO', 'EN_SEGUIMIENTO'],
        type: 'STAGE_CHANGE' as const,
      };
    }
    if (dimension === 'evaluation') {
      return {
        initial: 'SIN_EVALUAR',
        next: ['APTO', 'NO_APTO'],
        type: 'EVALUATION_CHANGE' as const,
      };
    }
    return {
      initial: null,
      next: [actor, secondUser],
      type: 'RESPONSIBLE_CHANGE' as const,
    };
  }

  function writeDimension(
    svc: CampaignsService,
    dimension: Dimension,
    value: string,
  ) {
    if (dimension === 'stage') {
      return svc.updateStage(campaignId, prospectId, value);
    }
    if (dimension === 'evaluation') {
      return svc.updateEvaluation(
        campaignId,
        prospectId,
        value,
        value === 'NO_APTO' ? 'Synthetic reason' : undefined,
      );
    }
    return svc.assignResponsible(campaignId, prospectId, value);
  }

  async function stateValue(dimension: Dimension) {
    const row = await db.campaignProspect.findUniqueOrThrow({
      where: participationWhere(),
    });
    if (dimension === 'stage') return row.commercialStage;
    if (dimension === 'evaluation') return row.evaluation;
    return row.responsibleId;
  }

  it.each(dimensions)(
    'RI02 %s: identical concurrent requests create exactly one event',
    async (dimension) => {
      const spec = values(dimension);
      await overlap((svc) => writeDimension(svc, dimension, spec.next[0]));

      const events = await db.campaignActivity.findMany({
        where: { tenantId, campaignId, prospectId },
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: spec.type,
        previousValue: spec.initial,
        newValue: spec.next[0],
        actorUserId: actor,
      });
      expect(events[0].recordedAt).toBeInstanceOf(Date);
      expect(await stateValue(dimension)).toBe(spec.next[0]);
    },
    25000,
  );

  it.each(dimensions)(
    'RI02 %s: different concurrent requests preserve the actual previous value',
    async (dimension) => {
      const spec = values(dimension);
      await overlap((svc, index) =>
        writeDimension(svc, dimension, spec.next[index]),
      );

      const events = await db.campaignActivity.findMany({
        where: { tenantId, campaignId, prospectId },
      });
      expect(events).toHaveLength(2);
      expect(events.map((event) => event.newValue).sort()).toEqual(
        [...spec.next].sort(),
      );

      // Do not assume which lock waiter wins or timestamp precision/order.
      const roots = events.filter(
        (event) => event.previousValue === spec.initial,
      );
      expect(roots).toHaveLength(1);
      const first = roots[0];
      const second = events.find((event) => event.id !== first.id)!;
      expect(second.previousValue).toBe(first.newValue);
      expect(await stateValue(dimension)).toBe(second.newValue);

      for (const event of events) {
        expect(event.type).toBe(spec.type);
        expect(event.actorUserId).toBe(actor);
        expect(event.recordedAt).toBeInstanceOf(Date);
        if (event.newValue === 'NO_APTO') {
          expect(event.reason).toBe('Synthetic reason');
        }
      }
    },
    25000,
  );

  it('RI02 tenant-scoped mutations return hidden 404 without changing state/history', async () => {
    const before = await db.campaignProspect.findUniqueOrThrow({
      where: participationWhere(),
    });
    const foreignRun = <T>(fn: () => T) =>
      context.run(
        {
          tenantId: `other-${randomUUID()}`,
          userId: actor,
          tenantRole: 'OWNER',
          platformRole: null,
        },
        fn,
      );

    const svc = service();
    for (const mutate of [
      () => svc.updateStage(campaignId, prospectId, 'CONTACTADO'),
      () => svc.updateEvaluation(campaignId, prospectId, 'APTO'),
      () => svc.assignResponsible(campaignId, prospectId, actor),
    ]) {
      await expect(foreignRun(mutate)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
    expect(
      await db.campaignProspect.findUniqueOrThrow({
        where: participationWhere(),
      }),
    ).toEqual(before);
    expect(
      await db.campaignActivity.count({
        where: { tenantId, campaignId, prospectId },
      }),
    ).toBe(0);
  });

  it('RI04 removal of membership marks assignment ineligible without rewriting it or history', async () => {
    const svc = service();
    await run(() => svc.assignResponsible(campaignId, prospectId, secondUser));
    expect((await run(() => svc.dashboard(campaignId))).responsibility).toEqual(
      {
        [secondUser]: 1,
      },
    );
    const before = await db.campaignProspect.findUniqueOrThrow({
      where: participationWhere(),
    });
    const history = await db.campaignActivity.findMany({
      where: { tenantId, campaignId, prospectId },
      orderBy: { id: 'asc' },
    });

    await db.userTenant.delete({
      where: { userId_tenantId: { userId: secondUser, tenantId } },
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: secondUser } })).status,
    ).toBe('ACTIVO');

    expect((await run(() => svc.dashboard(campaignId))).responsibility).toEqual(
      {
        [`NO_ELEGIBLE:${secondUser}`]: 1,
      },
    );
    expect(
      await db.campaignProspect.findUniqueOrThrow({
        where: participationWhere(),
      }),
    ).toEqual(before);
    expect(
      await db.campaignActivity.findMany({
        where: { tenantId, campaignId, prospectId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(history);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      type: 'RESPONSIBLE_CHANGE',
      previousValue: null,
      newValue: secondUser,
      actorUserId: actor,
    });
  });

  async function expectIncorporation(
    id: string,
    expected: { new: number; reused: number; unknownLegacy: number },
  ) {
    const dashboard = await run(() => service().dashboard(id));
    expect(dashboard.incorporation).toEqual(expected);
    expect(
      Object.values(dashboard.incorporation).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(dashboard.total);
  }

  it('RI05 a real master PATCH does not turn legacy incorporation into reuse', async () => {
    const original = await db.campaignProspect.findUniqueOrThrow({
      where: participationWhere(),
    });
    await expectIncorporation(campaignId, {
      new: 0,
      reused: 0,
      unknownLegacy: 1,
    });

    await run(() => prospects().update(prospectId, { phone: '000123' }));

    await expectIncorporation(campaignId, {
      new: 0,
      reused: 0,
      unknownLegacy: 1,
    });
    const events = await db.prospectProvenance.findMany({
      where: { tenantId, prospectId },
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('MASTER_UPDATED');
    expect(
      await db.campaignProspect.findUniqueOrThrow({
        where: participationWhere(),
      }),
    ).toEqual(original);
    expect(
      await db.campaignActivity.count({ where: { tenantId, prospectId } }),
    ).toBe(0);
  });

  it('RI05 LINK in another campaign proves reuse there, not in the legacy origin', async () => {
    const original = await db.campaignProspect.findUniqueOrThrow({
      where: participationWhere(),
    });
    await run(() =>
      prospects().resolve({
        campaignId: otherCampaignId,
        name: 'Synthetic legacy prospect',
        resolution: 'LINK_EXISTING',
        candidateId: prospectId,
      }),
    );

    await expectIncorporation(campaignId, {
      new: 0,
      reused: 0,
      unknownLegacy: 1,
    });
    await expectIncorporation(otherCampaignId, {
      new: 0,
      reused: 1,
      unknownLegacy: 0,
    });
    const events = await db.prospectProvenance.findMany({
      where: { tenantId, prospectId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'LINKED',
      campaignId: otherCampaignId,
    });
    expect(
      await db.campaignProspect.findUniqueOrThrow({
        where: participationWhere(),
      }),
    ).toEqual(original);
  });

  it('RI05 reappearance in an existing legacy participation is not initial incorporation evidence', async () => {
    await run(() =>
      prospects().resolve({
        campaignId,
        name: 'Synthetic legacy prospect',
        resolution: 'LINK_EXISTING',
        candidateId: prospectId,
      }),
    );
    const events = await db.prospectProvenance.findMany({
      where: { tenantId, prospectId },
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('REAPPEARED');
    await expectIncorporation(campaignId, {
      new: 0,
      reused: 0,
      unknownLegacy: 1,
    });
  });

  it('RI05 real creation stays new in A and real linking is reused in B', async () => {
    const created = await run(() =>
      prospects().create({
        campaignId,
        name: 'Synthetic verified creation',
      }),
    );
    await run(() =>
      prospects().resolve({
        campaignId: otherCampaignId,
        name: 'Synthetic verified creation',
        resolution: 'LINK_EXISTING',
        candidateId: created.id,
      }),
    );
    await run(() => prospects().update(created.id, { phone: '000456' }));

    // A also contains the original legacy fixture.
    await expectIncorporation(campaignId, {
      new: 1,
      reused: 0,
      unknownLegacy: 1,
    });
    await expectIncorporation(otherCampaignId, {
      new: 0,
      reused: 1,
      unknownLegacy: 0,
    });
  });
});
