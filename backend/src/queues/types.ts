/** Public API job status values. */
export type QueueJobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export type QueueJobType = 'tender-analysis' | 'report-generation' | 'tender-extraction';

export interface TenderAnalysisJobPayload {
  queueJobId: string;
  jobId: string;
  tenderId: string;
  documentId: string;
  userId: string;
  skipFastPhase?: boolean;
}

export interface ReportGenerationJobPayload {
  queueJobId: string;
  tenderId: string;
  userId: string;
}

export interface TenderExtractionJobPayload {
  queueJobId: string;
  tenderId: string;
  documentId: string;
  extractionId: string;
  userId: string;
  provider?: 'openai' | 'gemini';
}

export interface JobStatusResponse {
  jobId: string;
  status: QueueJobStatus;
  progress: number;
  type?: QueueJobType;
  tenderId?: string;
  errorMessage?: string;
}
