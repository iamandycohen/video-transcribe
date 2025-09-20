export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export interface StepError {
    message: string;
    code?: string;
    details?: any;
}
export interface WorkflowStep {
    status: StepStatus;
    started_at?: string;
    completed_at?: string;
    failed_at?: string;
    error?: StepError;
    processing_time?: number;
}
//# sourceMappingURL=step-types.d.ts.map