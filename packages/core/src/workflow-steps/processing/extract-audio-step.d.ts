import { WorkflowStep } from '../base';
export interface ExtractAudioStep extends WorkflowStep {
    result?: {
        audio_url: string;
        extraction_time: number;
        video_cleaned: boolean;
        audio_size?: number;
    };
}
//# sourceMappingURL=extract-audio-step.d.ts.map