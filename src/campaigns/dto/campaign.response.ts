export interface CampaignResponse {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVA' | 'PAUSADA' | 'COMPLETADA' | 'ARCHIVADA';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
