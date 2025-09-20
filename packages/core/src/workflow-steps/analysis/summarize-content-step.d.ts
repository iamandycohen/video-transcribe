import { WorkflowStep } from '../base';
export interface SummarizeContentStep extends WorkflowStep {
    result?: {
        summary: string;
        summary_length: number;
        processing_time: number;
        model_used: string;
    };
}
//# sourceMappingURL=summarize-content-step.d.ts.map