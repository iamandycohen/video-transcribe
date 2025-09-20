import { WorkflowStep } from '../base';
export interface AnalyzeSentimentStep extends WorkflowStep {
    result?: {
        sentiment: {
            value: string;
            confidence: number;
        };
        processing_time: number;
        model_used: string;
    };
}
//# sourceMappingURL=analyze-sentiment-step.d.ts.map