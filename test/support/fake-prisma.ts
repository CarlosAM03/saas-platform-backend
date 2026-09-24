import * as bcrypt from 'bcrypt';
import { Prisma, User, Role, UserTenant, Tenant } from '@prisma/client';

export interface FakePrismaState {
  users: User[];
  tenants: Tenant[];
  roles: Pick<Role, 'id' | 'tenantId' | 'name' | 'description'>[];
  userTenants: UserTenant[];
}

const now = new Date('2026-09-09T00:00:00.000Z');

export async function createFakePrisma() {
  const ownerPassword = await bcrypt.hash('SecurePass123!', 4);
  const memberPassword = await bcrypt.hash('SecurePass123!', 4);
  const inactivePassword = await bcrypt.hash('SecurePass123!', 4);
  const state: FakePrismaState = {
    tenants: [
      {
        id: 'tenant-a',
        name: 'Tenant A',
        slug: 'tenant-a',
        status: 'ACTIVO',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'tenant-b',
        name: 'Tenant B',
        slug: 'tenant-b',
        status: 'ACTIVO',
        createdAt: now,
        updatedAt: now,
      },
    ],
    roles: [
      {
        id: 'role-a-owner',
        tenantId: 'tenant-a',
        name: 'OWNER',
        description: null,
      },
      {
        id: 'role-a-member',
        tenantId: 'tenant-a',
        name: 'MEMBER',
        description: null,
      },
      {
        id: 'role-b-owner',
        tenantId: 'tenant-b',
        name: 'OWNER',
        description: null,
      },
      {
        id: 'role-b-member',
        tenantId: 'tenant-b',
        name: 'MEMBER',
        description: null,
      },
    ],
    users: [
      {
        id: 'user-owner',
        name: 'Owner A',
        email: 'owner@example.com',
        passwordHash: ownerPassword,
        platformRole: null,
        status: 'ACTIVO',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-member',
        name: 'Member A',
        email: 'member@example.com',
        passwordHash: memberPassword,
        platformRole: null,
        status: 'ACTIVO',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-multi',
        name: 'Multi Tenant',
        email: 'multi@example.com',
        passwordHash: memberPassword,
        platformRole: null,
        status: 'ACTIVO',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-inactive',
        name: 'Inactive User',
        email: 'inactive@example.com',
        passwordHash: inactivePassword,
        platformRole: null,
        status: 'INACTIVO',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-admin',
        name: 'Platform Admin',
        email: 'admin@example.com',
        passwordHash: ownerPassword,
        platformRole: 'ADMIN',
        status: 'ACTIVO',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-owner-b',
        name: 'Owner B',
        email: 'owner-b@example.com',
        passwordHash: ownerPassword,
        platformRole: null,
        status: 'ACTIVO',
        createdAt: now,
        updatedAt: now,
      },
    ],
    userTenants: [
      {
        userId: 'user-owner',
        tenantId: 'tenant-a',
        roleId: 'role-a-owner',
        joinedAt: now,
      },
      {
        userId: 'user-member',
        tenantId: 'tenant-a',
        roleId: 'role-a-member',
        joinedAt: now,
      },
      {
        userId: 'user-multi',
        tenantId: 'tenant-a',
        roleId: 'role-a-member',
        joinedAt: now,
      },
      {
        userId: 'user-multi',
        tenantId: 'tenant-b',
        roleId: 'role-b-owner',
        joinedAt: now,
      },
      {
        userId: 'user-owner-b',
        tenantId: 'tenant-b',
        roleId: 'role-b-owner',
        joinedAt: now,
      },
    ],
  };

  type Where = {
    id?: string;
    email?: string;
    tenantId?: string;
    status?: string;
    userTenants?: { some?: { tenantId?: string; userId?: string } };
    OR?: Array<Partial<Record<'name' | 'email', { contains: string }>>>;
  };
  type UserArgs = {
    where: Where;
    include?: unknown;
    select?: unknown;
    skip?: number;
    take?: number;
    orderBy?: Partial<Record<keyof User, 'asc' | 'desc'>>;
  };
  const findTenant = (id: string) => state.tenants.find((t) => t.id === id)!;
  const findRole = (id: string) => state.roles.find((r) => r.id === id)!;
  const hydrateMembership = (m: UserTenant) => ({
    ...m,
    tenant: findTenant(m.tenantId),
    role: findRole(m.roleId),
  });
  const hydrateUser = (u: User) => ({
    ...u,
    userTenants: state.userTenants
      .filter((m) => m.userId === u.id)
      .map(hydrateMembership),
  });
  const matches = (u: User, w: Where) =>
    (!w.id || u.id === w.id) &&
    (!w.email || u.email === w.email) &&
    (!w.userTenants?.some?.tenantId ||
      state.userTenants.some(
        (m) =>
          m.userId === u.id && m.tenantId === w.userTenants?.some?.tenantId,
      )) &&
    (!w.OR ||
      w.OR.some((c) =>
        Object.entries(c).some(([k, v]) =>
          String(u[k as keyof User])
            .toLowerCase()
            .includes(v.contains.toLowerCase()),
        ),
      ));
  const findUser = (w: Where) => state.users.find((u) => matches(u, w));
  type MembershipArgs = {
    where: { userId_tenantId: { userId: string; tenantId: string } };
    include?: unknown;
  };
  const findMembership = ({ where }: MembershipArgs) =>
    state.userTenants.find(
      (m) =>
        m.userId === where.userId_tenantId.userId &&
        m.tenantId === where.userId_tenantId.tenantId,
    );
  const matchesTenant = (tenant: Tenant, where: Where) =>
    (!where.id || tenant.id === where.id) &&
    (!where.status || tenant.status === where.status) &&
    (!where.userTenants?.some?.userId ||
      state.userTenants.some(
        (membership) =>
          membership.tenantId === tenant.id &&
          membership.userId === where.userTenants?.some?.userId,
      ));
  const prisma = {
    _state: state,
    $connect: () => Promise.resolve(),
    $disconnect: () => Promise.resolve(),
    $queryRaw: () => Promise.resolve([{ value: 1 }]),
    user: {
      findUnique: ({ where }: UserArgs) => {
        const u = findUser(where);
        return u ? hydrateUser(u) : null;
      },
      findUniqueOrThrow: ({ where }: UserArgs) => {
        const u = findUser(where);
        if (!u) throw new Error('User not found');
        return hydrateUser(u);
      },
      findFirst: ({ where }: UserArgs) => {
        const u = findUser(where);
        return u ? hydrateUser(u) : null;
      },
      findMany: ({
        where,
        skip = 0,
        take = state.users.length,
        orderBy,
      }: UserArgs) => {
        const users = state.users.filter((u) => matches(u, where));
        const [key, direction] = Object.entries(orderBy ?? { name: 'asc' })[0];
        users.sort(
          (a, b) =>
            String(a[key as keyof User]).localeCompare(
              String(b[key as keyof User]),
            ) * (direction === 'desc' ? -1 : 1),
        );
        return users.slice(skip, skip + take).map(hydrateUser);
      },
      count: ({ where }: UserArgs) =>
        state.users.filter((u) => matches(u, where)).length,
      create: ({
        data,
      }: {
        data: Pick<User, 'name' | 'email' | 'passwordHash'>;
      }) => {
        if (state.users.some((u) => u.email === data.email))
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002',
            clientVersion: 'test',
          });
        const u: User = {
          id: 'user-' + (state.users.length + 1),
          ...data,
          platformRole: null,
          status: 'ACTIVO',
          createdAt: now,
          updatedAt: now,
        };
        state.users.push(u);
        return hydrateUser(u);
      },
      update: ({ where, data }: { where: Where; data: Partial<User> }) => {
        const u = findUser(where);
        if (!u) throw new Error('User not found');
        Object.assign(
          u,
          Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined),
          ),
          { updatedAt: now },
        );
        return hydrateUser(u);
      },
    },
    userTenant: {
      create: ({
        data,
      }: {
        data: Omit<UserTenant, 'joinedAt'>;
        include?: unknown;
      }) => {
        const m = { ...data, joinedAt: now };
        state.userTenants.push(m);
        return hydrateMembership(m);
      },
      findUnique: (args: MembershipArgs) => {
        const m = findMembership(args);
        return m ? hydrateMembership(m) : null;
      },
      update: (args: MembershipArgs & { data: Partial<UserTenant> }) => {
        const m = findMembership(args);
        if (!m) throw new Error('Membership not found');
        Object.assign(m, args.data);
        return hydrateMembership(m);
      },
      findMany: ({
        where,
      }: {
        where: {
          userId: string;
          tenantId?: string;
          tenant?: { status: string };
        };
        include?: unknown;
        orderBy?: unknown;
      }) =>
        state.userTenants
          .filter(
            (m) =>
              m.userId === where.userId &&
              (!where.tenantId || m.tenantId === where.tenantId),
          )
          .map(hydrateMembership)
          .filter(
            (m) =>
              !where.tenant?.status || m.tenant.status === where.tenant.status,
          ),
    },
    role: {
      findUnique: ({
        where,
      }: {
        where: {
          id?: string;
          tenantId_name?: { tenantId: string; name: string };
        };
      }) =>
        state.roles.find((r) =>
          where.id
            ? r.id === where.id
            : r.tenantId === where.tenantId_name?.tenantId &&
              r.name === where.tenantId_name?.name,
        ) ?? null,
      findFirst: ({ where }: { where: Where }) =>
        state.roles.find(
          (r) =>
            (!where.id || r.id === where.id) &&
            (!where.tenantId || r.tenantId === where.tenantId),
        ) ?? null,
      findMany: ({ where }: { where: Where }) =>
        state.roles.filter(
          (r) => !where.tenantId || r.tenantId === where.tenantId,
        ),
    },
    tenant: {
      findFirst: ({ where }: { where: Where; select?: unknown }) =>
        state.tenants.find((tenant) => matchesTenant(tenant, where)) ?? null,
      findMany: ({
        where,
      }: {
        where: Where;
        select?: unknown;
        orderBy?: unknown;
      }) =>
        state.tenants
          .filter((tenant) => matchesTenant(tenant, where))
          .sort(
            (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
          ),
      create: ({
        data,
      }: {
        data: {
          name: string;
          slug: string;
          roles: { create: { name: Role['name'] }[] };
        };
        select?: unknown;
      }) => {
        if (state.tenants.some((tenant) => tenant.slug === data.slug)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        const tenant: Tenant = {
          id: 'c' + String(state.tenants.length + 1).padStart(24, '0'),
          name: data.name,
          slug: data.slug,
          status: 'ACTIVO',
          createdAt: now,
          updatedAt: now,
        };
        state.tenants.push(tenant);
        state.roles.push(
          ...data.roles.create.map((role) => ({
            id: `${tenant.id}-${role.name}`,
            tenantId: tenant.id,
            name: role.name,
            description: null,
          })),
        );
        return tenant;
      },
    },
  };
  return Object.assign(prisma, {
    $transaction: <T>(operation: T[] | ((transaction: typeof prisma) => T)) =>
      Array.isArray(operation) ? Promise.all(operation) : operation(prisma),
  });
}
