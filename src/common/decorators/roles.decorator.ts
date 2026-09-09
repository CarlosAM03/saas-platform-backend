import { SetMetadata } from '@nestjs/common';

export const AUTHORIZED_ROLES_KEY = 'authorizedRoles';
export type AuthorizedRole = 'ADMIN' | 'OWNER' | 'MEMBER';
export const Roles = (...roles: AuthorizedRole[]) =>
  SetMetadata(AUTHORIZED_ROLES_KEY, roles);
