/* eslint-disable @typescript-eslint/no-explicit-any */
import * as bcrypt from 'bcrypt';

export interface FakePrismaState {
  users: any[];
  tenants: any[];
  roles: any[];
  userTenants: any[];
}

const now = new Date('2026-09-09T00:00:00.000Z');

export async function createFakePrisma(): Promise<any> {
  const ownerPassword = await bcrypt.hash('SecurePass123!', 4);
  const memberPassword = await bcrypt.hash('SecurePass123!', 4);
  const inactivePassword = await bcrypt.hash('SecurePass123!', 4);
  const state: FakePrismaState = {
    tenants: [
      { id: 'tenant-a', name: 'Tenant A', slug: 'tenant-a', status: 'ACTIVO' },
      { id: 'tenant-b', name: 'Tenant B', slug: 'tenant-b', status: 'ACTIVO' },
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

  const findTenant = (id: string) =>
    state.tenants.find((tenant) => tenant.id === id);
  const findRole = (id: string) => state.roles.find((role) => role.id === id);
  const hydrateUser = (user: any) => ({
    ...user,
    userTenants: state.userTenants
      .filter((membership) => membership.userId === user.id)
      .map((membership) => ({
        ...membership,
        tenant: findTenant(membership.tenantId),
        role: findRole(membership.roleId),
      })),
  });
  const findUser = (where: any) => {
    if (where.id) return state.users.find((user) => user.id === where.id);
    if (where.email)
      return state.users.find((user) => user.email === where.email);
    return undefined;
  };
  const matchesTenant = (user: any, tenantId: string) =>
    state.userTenants.some(
      (membership) =>
        membership.userId === user.id && membership.tenantId === tenantId,
    );

  const prisma: any = {
    _state: state,
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $queryRaw: async () => [{ '?column?': 1 }],
    $transaction: async (operation: any) => {
      if (Array.isArray(operation)) return Promise.all(operation);
      return operation(prisma);
    },
    user: {
      findUnique: async ({ where }: any) => {
        const user = findUser(where);
        return user ? hydrateUser(user) : null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const user = findUser(where);
        if (!user) throw new Error('User not found');
        return hydrateUser(user);
      },
      findFirst: async ({ where }: any) => {
        const user = state.users.find((candidate) => {
          if (where.id && candidate.id !== where.id) return false;
          if (
            where.userTenants?.some?.tenantId &&
            !matchesTenant(candidate, where.userTenants.some.tenantId)
          ) {
            return false;
          }
          if (
            where.OR &&
            !where.OR.some((condition: any) => {
              const [field, filter] = Object.entries(condition)[0] as [
                string,
                any,
              ];
              return candidate[field]
                .toLowerCase()
                .includes(filter.contains.toLowerCase());
            })
          )
            return false;
          return true;
        });
        return user ? hydrateUser(user) : null;
      },
      findMany: async ({ where }: any) =>
        state.users
          .filter(
            (user) =>
              !where.userTenants?.some?.tenantId ||
              matchesTenant(user, where.userTenants.some.tenantId),
          )
          .filter(
            (user) =>
              !where.OR ||
              where.OR.some((condition: any) => {
                const [field, filter] = Object.entries(condition)[0] as [
                  string,
                  any,
                ];
                return user[field]
                  .toLowerCase()
                  .includes(filter.contains.toLowerCase());
              }),
          )
          .map(hydrateUser)
          .slice(
            where.skip ?? 0,
            (where.skip ?? 0) + (where.take ?? state.users.length),
          ),
      count: async ({ where }: any) =>
        state.users.filter(
          (user) =>
            !where.userTenants?.some?.tenantId ||
            matchesTenant(user, where.userTenants.some.tenantId),
        ).length,
      create: async ({ data }: any) => {
        if (state.users.some((user) => user.email === data.email)) {
          const error: any = new Error('Unique constraint');
          error.code = 'P2002';
          throw error;
        }
        const user = {
          id: `user-${state.users.length + 1}`,
          ...data,
          platformRole: null,
          status: 'ACTIVO',
          createdAt: now,
          updatedAt: now,
        };
        state.users.push(user);
        return hydrateUser(user);
      },
      update: async ({ where, data }: any) => {
        const user = findUser(where);
        if (!user) throw new Error('User not found');
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined) user[key] = value;
        });
        user.updatedAt = now;
        return hydrateUser(user);
      },
    },
    userTenant: {
      create: async ({ data }: any) => {
        state.userTenants.push({ ...data, joinedAt: now });
        return data;
      },
      findUnique: async ({ where }: any) =>
        state.userTenants.find(
          (item) =>
            item.userId === where.userId_tenantId.userId &&
            item.tenantId === where.userId_tenantId.tenantId,
        ) ?? null,
      update: async ({ where, data }: any) => {
        const item = state.userTenants.find(
          (membership) =>
            membership.userId === where.userId_tenantId.userId &&
            membership.tenantId === where.userId_tenantId.tenantId,
        );
        if (!item) throw new Error('Membership not found');
        Object.assign(item, data);
        return item;
      },
      findMany: async ({ where }: any) =>
        state.userTenants
          .filter((item) => item.userId === where.userId)
          .map((item) => ({
            ...item,
            tenant: findTenant(item.tenantId),
            role: findRole(item.roleId),
          })),
    },
    role: {
      findUnique: async ({ where }: any) =>
        state.roles.find(
          (role) =>
            role.id === where.id ||
            (role.tenantId === where.tenantId_name.tenantId &&
              role.name === where.tenantId_name.name),
        ) ?? null,
      findFirst: async ({ where }: any) =>
        state.roles.find(
          (role) =>
            (!where.id || role.id === where.id) &&
            (!where.tenantId || role.tenantId === where.tenantId),
        ) ?? null,
      findMany: async ({ where }: any) =>
        state.roles.filter(
          (role) => !where?.tenantId || role.tenantId === where.tenantId,
        ),
    },
    tenant: {
      findFirst: async ({ where }: any) =>
        state.tenants.find(
          (tenant) =>
            (!where?.id || tenant.id === where.id) &&
            (!where?.status || tenant.status === where.status),
        ) ?? null,
    },
  };

  return prisma;
}
