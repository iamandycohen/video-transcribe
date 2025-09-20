import { WorkflowStep } from '../base';
export interface EnhanceTranscriptionStep extends WorkflowStep {
    result?: {
        enhanced_text: string;
        enhancement_time: number;
        model_used: string;
    };
}
//# sourceMappingURL=enhance-transcription-step.d.ts.map