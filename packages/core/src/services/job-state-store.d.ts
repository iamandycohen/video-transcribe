export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobOperation = 'upload_video' | 'extract_audio' | 'transcribe_audio' | 'enhance_transcription';
export interface JobError {
    code: string;
    message: string;
    retryable: boolean;
    retry_after?: number;
    details?: any;
}
export interface JobState {
    job_id: string;
    workflow_id: string;
    operation: JobOperation;
    status: JobStatus;
    progress: number;
    message: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    cancelled_at?: string;
    input_params: any;
    result?: any;
    error?: JobError;
    cancel_reason?: string;
    estimated_completion?: string;
    last_progress_update?: string;
}
export interface JobProgressUpdate {
    progress?: number;
    message?: string;
    estimated_completion?: string;
}
export declare class JobStateStore {
    private jobsDirectory;
    private activeJobs;
    constructor();
    initialize(): Promise<void>;
    createJob(params: {
        workflow_id: string;
        operation: JobOperation;
        input_params: any;
    }): Promise<string>;
    getJob(job_id: string): Promise<JobState | null>;
    updateJobStatus(job_id: string, status: JobStatus, message?: string): Promise<void>;
    updateJobProgress(job_id: string, update: JobProgressUpdate): Promise<void>;
    setJobResult(job_id: string, result: any): Promise<void>;
    setJobError(job_id: string, error: JobError): Promise<void>;
    cancelJob(job_id: string, reason?: string): Promise<boolean>;
    getCancellationToken(job_id: string): AbortSignal | null;
    isJobCancelled(job_id: string): Promise<boolean>;
    getJobsForWorkflow(workflow_id: string): Promise<JobState[]>;
    cleanupOldJobs(maxAgeHours?: number): Promise<number>;
    getJobStats(): Promise<{
        total: number;
        byStatus: Record<JobStatus, number>;
        byOperation: Record<JobOperation, number>;
        activeJobs: number;
    }>;
    calculateEstimatedCompletion(operation: JobOperation, inputParams: any): string | undefined;
    private getJobPath;
    private saveJobState;
}
//# sourceMappingURL=job-state-store.d.ts.map