import { WorkflowStep } from '../base';
export interface IdentifyTopicsStep extends WorkflowStep {
    result?: {
        topics: string[];
        topics_count: number;
        processing_time: number;
        model_used: string;
    };
}
//# sourceMappingURL=identify-topics-step.d.ts.map