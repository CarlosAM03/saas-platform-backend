import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminName = process.env.ADMIN_NAME;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminName || !adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required to run the seed.',
    );
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    if (
      existingAdmin.platformRole !== 'ADMIN' ||
      existingAdmin.status !== 'ACTIVO'
    ) {
      throw new Error(
        'Existing seed account is not an active global ADMIN; review the account explicitly.',
      );
    }
    console.log(`ADMIN already exists: ${adminEmail}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        platformRole: 'ADMIN',
      },
    });
    console.log(`ADMIN created: ${adminEmail}`);
  }

  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!tenant) {
    console.log(
      'No tenant found; OWNER and MEMBER roles were not created. No system tenant was added.',
    );
    return;
  }

  for (const roleName of [RoleName.OWNER, RoleName.MEMBER]) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: roleName,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: roleName,
        description:
          roleName === RoleName.OWNER
            ? 'Tenant owner role'
            : 'Tenant member role',
      },
    });

    console.log(`Role ${role.name} ensured for tenant: ${tenant.slug}`);
  }
}

main()
  .catch(() => {
    console.error(
      'Seed failed; verify configuration, database availability and the seed account.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
