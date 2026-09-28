export interface AcceptedJob {
  jobId: string;
  status: 'QUEUED';
  acceptedAt: string;
}

export interface AcceptedJobResponse {
  success: true;
  data: AcceptedJob;
}
