export interface ProspectResponse {
  id: string;
  campaignId: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  source: 'google_maps';
  sourceIdentifier: string | null;
  language: string | null;
  status: 'ACTIVO' | 'INACTIVO';
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
