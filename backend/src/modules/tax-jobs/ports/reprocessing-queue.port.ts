export interface CreateJobInput {
  tenantId?: string;
  requestedByUserId: string;
  scopeType: string;
  scopePayloadJson: any;
  reason: string;
  engineVersionFrom?: string;
  engineVersionTo?: string;
}

export abstract class ReprocessingQueuePort {
  abstract createJob(input: CreateJobInput): Promise<string>;
  abstract getPendingJobs(): Promise<any[]>;
  abstract lockJob(jobId: string): Promise<boolean>;
  abstract getJobProgress(jobId: string): Promise<any>;
  abstract cancelJob(jobId: string): Promise<void>;
}
