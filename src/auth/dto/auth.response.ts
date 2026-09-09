export interface AuthTenantResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  platformRole: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthContextResponse {
  accessToken: string;
  user: AuthUserResponse;
  tenants: AuthTenantResponse[];
  currentTenantId: string | null;
}
