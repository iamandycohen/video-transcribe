import { WorkflowStep } from '../base';
export interface UploadVideoStep extends WorkflowStep {
    result?: {
        video_url: string;
        size: number;
        format: string;
        source_url?: string;
    };
}
//# sourceMappingURL=upload-video-step.d.ts.map