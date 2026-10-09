import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import {
  CampaignStatus,
  type Campaign,
  PrismaClient,
  ProspectingJobStatus,
  RoleName,
  UserStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (!['local', 'shared-dev'].includes(process.env.DATABASE_ENV ?? '')) {
    throw new Error('seed_dev requires DATABASE_ENV=local or shared-dev.');
  }
  const password = process.env.DEV_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('DEV_SEED_PASSWORD must contain at least 12 characters.');
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const adminEmail = 'admin@demo.example';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (existingAdmin && existingAdmin.id !== 'demo-admin') {
    throw new Error('Demo ADMIN email belongs to another account.');
  }
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, status: UserStatus.ACTIVO, platformRole: 'ADMIN' },
    create: {
      id: 'demo-admin',
      name: 'Demo Admin',
      email: adminEmail,
      passwordHash,
      platformRole: 'ADMIN',
    },
  });

  const tenants = [
    { id: 'demo-tenant-norte', slug: 'demo-norte', name: 'Demo Norte' },
    { id: 'demo-tenant-sur', slug: 'demo-sur', name: 'Demo Sur' },
  ];
  for (const tenantData of tenants) {
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: tenantData.slug },
    });
    if (existingTenant && existingTenant.id !== tenantData.id) {
      throw new Error(
        `Demo tenant slug belongs to another tenant: ${tenantData.slug}`,
      );
    }
    const tenant = await prisma.tenant.upsert({
      where: { slug: tenantData.slug },
      update: {},
      create: tenantData,
    });
    const roles = {} as Record<RoleName, string>;
    for (const name of [RoleName.OWNER, RoleName.MEMBER]) {
      const role = await prisma.role.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: {},
        create: {
          id: `demo-role-${tenant.slug}-${name.toLowerCase()}`,
          tenantId: tenant.id,
          name,
        },
      });
      roles[name] = role.id;
    }
    const people = [
      { role: RoleName.OWNER, name: `Owner ${tenant.name}` },
      { role: RoleName.MEMBER, name: `Member ${tenant.name}` },
    ];
    for (const person of people) {
      const id = `demo-user-${tenant.slug}-${person.role.toLowerCase()}`;
      const email = `${person.role.toLowerCase()}.${tenant.slug}@demo.example`;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== id) {
        throw new Error(`Demo email belongs to another account: ${email}`);
      }
      const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash, status: UserStatus.ACTIVO },
        create: { id, name: person.name, email, passwordHash },
      });
      await prisma.userTenant.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
        update: { roleId: roles[person.role] },
        create: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: roles[person.role],
        },
      });
    }
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `owner.${tenant.slug}@demo.example` },
    });
    const campaigns: Campaign[] = [];
    for (let campaignIndex = 1; campaignIndex <= 3; campaignIndex++) {
      const id = `demo-campaign-${tenant.slug}-${campaignIndex}`;
      const campaign = await prisma.campaign.upsert({
        where: { id },
        update: {},
        create: {
          id,
          tenantId: tenant.id,
          createdBy: owner.id,
          name: `Campaña ${campaignIndex} ${tenant.name}`,
          status: CampaignStatus.ACTIVA,
        },
      });
      campaigns.push(campaign);
      for (let prospectIndex = 1; prospectIndex <= 6; prospectIndex++) {
        const prospectId = `demo-prospect-${tenant.slug}-${campaignIndex}-${prospectIndex}`;
        await prisma.prospect.upsert({
          where: { id: prospectId },
          update: { source: 'google_maps' },
          create: {
            id: prospectId,
            tenantId: tenant.id,
            campaignId: campaign.id,
            name: `Prospecto ${prospectIndex} ${tenant.name}`,
            category: prospectIndex % 2 === 0 ? 'Restaurante' : 'Comercio',
            source: 'google_maps',
            sourceIdentifier: prospectId,
          },
        });
      }
    }
    for (let prospectIndex = 1; prospectIndex <= 6; prospectIndex++) {
      await prisma.campaignProspect.upsert({
        where: {
          campaignId_prospectId: {
            campaignId: campaigns[1].id,
            prospectId: `demo-prospect-${tenant.slug}-1-${prospectIndex}`,
          },
        },
        update: {},
        create: {
          campaignId: campaigns[1].id,
          prospectId: `demo-prospect-${tenant.slug}-1-${prospectIndex}`,
        },
      });
    }
    const startedAt = new Date('2026-09-24T09:00:00.000Z');
    const completedAt = new Date('2026-09-24T09:05:00.000Z');
    const jobs = [
      {
        status: ProspectingJobStatus.QUEUED,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      {
        status: ProspectingJobStatus.RUNNING,
        startedAt,
        completedAt: null,
        error: null,
      },
      {
        status: ProspectingJobStatus.COMPLETED,
        startedAt,
        completedAt,
        error: null,
      },
      {
        status: ProspectingJobStatus.FAILED,
        startedAt,
        completedAt,
        error: 'Demo: simulated provider failure',
      },
      {
        status: ProspectingJobStatus.CANCELLED,
        startedAt,
        completedAt,
        error: null,
      },
    ];
    for (let index = 0; index < jobs.length; index++) {
      const lifecycle = jobs[index];
      const id = `demo-job-${tenant.slug}-${lifecycle.status.toLowerCase()}`;
      await prisma.prospectingJob.upsert({
        where: { id },
        update: {
          status: lifecycle.status,
          startedAt: lifecycle.startedAt,
          completedAt: lifecycle.completedAt,
          error: lifecycle.error,
        },
        create: {
          id,
          tenantId: tenant.id,
          campaignId: campaigns[index % campaigns.length].id,
          requestedBy: owner.id,
          ...lifecycle,
          query: {
            keyword: 'demo',
            location: 'Tijuana',
            source: 'demo',
            limit: 10,
          },
          requestedLimit: 10,
        },
      });
    }
  }
  console.log(
    'Development dataset ensured (2 tenants, 6 campaigns, 36 prospects).',
  );
}

main()
  .catch((error: unknown) => {
    console.error('Development seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
