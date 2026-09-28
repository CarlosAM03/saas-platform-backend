export interface ProspectingQuery {
  keyword: string;
  location: string;
  source: 'google_maps';
  limit: number;
}

export interface StartProspectingJobRequest {
  jobId: string;
  tenantId: string;
  query: ProspectingQuery;
  callbackUrl: string;
}
