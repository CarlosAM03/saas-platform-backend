export interface UserRoleResponse {
  id: string;
  name: 'OWNER' | 'MEMBER';
  tenantId: string;
}

export interface UserTenantResponse {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: UserRoleResponse;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  platformRole: string | null;
  role: UserRoleResponse | null;
  tenants: UserTenantResponse[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
