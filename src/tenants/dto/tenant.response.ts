export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVO' | 'SUSPENDIDO';
  createdAt: Date;
  updatedAt: Date;
}
