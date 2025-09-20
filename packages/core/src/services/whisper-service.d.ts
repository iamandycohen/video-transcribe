import { ProgressCallback } from '../types/progress';
declare const QUALITY_MODEL_MAP: {
    readonly fast: "tiny";
    readonly balanced: "base";
    readonly accurate: "medium";
    readonly best: "large";
};
declare const MODEL_SIZES: {
    readonly tiny: {
        readonly size: "39MB";
        readonly speed: "fastest";
        readonly accuracy: "lowest";
    };
    readonly base: {
        readonly size: "74MB";
        readonly speed: "fast";
        readonly accuracy: "good";
    };
    readonly small: {
        readonly size: "244MB";
        readonly speed: "medium";
        readonly accuracy: "better";
    };
    readonly medium: {
        readonly size: "769MB";
        readonly speed: "slower";
        readonly accuracy: "high";
    };
    readonly large: {
        readonly size: "1550MB";
        readonly speed: "slowest";
        readonly accuracy: "highest";
    };
};
export type WhisperModel = keyof typeof MODEL_SIZES;
export type WhisperQuality = keyof typeof QUALITY_MODEL_MAP;
export interface WhisperOptions {
    model?: WhisperModel;
    quality?: WhisperQuality;
    language?: string;
    cacheDir?: string;
    verbose?: boolean;
}
export interface WhisperResult {
    text: string;
    segments: Array<{
        start: number;
        end: number;
        text: string;
    }>;
    language: string;
    duration: number;
    processingTime: number;
}
export interface WhisperProgress {
    type: 'download' | 'transcription';
    progress: number;
    message: string;
    estimatedTimeRemaining?: number;
}
export declare class WhisperService {
    private cacheDir;
    private nodeWhisper;
    constructor(options?: {
        cacheDir?: string;
    });
    transcribeAudio(audioPath: string, options?: WhisperOptions, onProgress?: ProgressCallback): Promise<WhisperResult>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        message: string;
    }>;
    getModelInfo(): Record<WhisperModel, typeof MODEL_SIZES[WhisperModel] & {
        cached: boolean;
    }>;
    downloadModel(model: WhisperModel, onProgress?: (progress: WhisperProgress) => void): Promise<void>;
    clearCache(): Promise<void>;
    private resolveModel;
    private loadNodeWhisper;
    private ensureModelAvailable;
    private downloadModelFromSource;
    private isModelCached;
    private getModelPath;
    private ensureCacheDir;
    private parseWhisperResult;
    private getAudioDuration;
    private processAudioForNode;
    private handleWhisperError;
    private getSmallerModelSuggestions;
}
export {};
//# sourceMappingURL=whisper-service.d.ts.map