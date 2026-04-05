import { AuthContext } from '../dto/create-job.dto';

export interface CreateJobInput {
  tenantId: string;
  requestedByUserId: string;
  buyerCompanyId: string;
  scopeType: string;
  scopePayloadJson: Record<string, any>;
  reason: string;
  engineVersionFrom?: string;
  engineVersionTo?: string;
}

export interface JobSummary {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  buyerCompanyId: string;
  scopeType: string;
  reason: string;
  status: string;
  totalItems: number;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  cancelRequestedAt?: Date;
  retryCount: number;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  items?: any[];
}

export abstract class ReprocessingQueuePort {
  abstract createJob(input: CreateJobInput, authContext: AuthContext): Promise<string>;
  abstract getPendingJobs(tenantId?: string): Promise<JobSummary[]>;
  abstract lockJob(jobId: string): Promise<boolean>;
  abstract getJobProgress(jobId: string): Promise<JobSummary | null>;
  abstract cancelJob(jobId: string): Promise<void>;
  abstract cancelJobCooperative(jobId: string): Promise<void>;
  abstract isJobCancelled(jobId: string): Promise<boolean>;
}
