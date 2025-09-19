export type ProgressType = 'download' | 'extraction' | 'transcription' | 'enhancement' | 'model_download' | 'workflow';
export interface ProgressEvent {
    type: ProgressType;
    progress: number;
    message: string;
    metadata?: {
        step?: number;
        totalSteps?: number;
        estimatedTimeRemaining?: number;
        speed?: string;
        size?: {
            processed: number;
            total: number;
            unit: string;
        };
    };
    timestamp?: number;
}
export type ProgressCallback = (event: ProgressEvent) => void;
export declare class ProgressAggregator {
    private steps;
    private callback;
    constructor(callback: ProgressCallback);
    defineSteps(steps: Record<string, number>): void;
    updateStep(stepName: string, progress: number, message: string): void;
    createStepCallback(stepName: string): ProgressCallback;
}
export declare class ProgressReporters {
    static console(verbose?: boolean): ProgressCallback;
    static json(): {
        callback: ProgressCallback;
        getLatest: () => ProgressEvent | null;
    };
    static websocket(ws: any): ProgressCallback;
    static agent(): {
        callback: ProgressCallback;
        getStatusMessage: () => string;
        getDetailedStatus: () => ProgressEvent | null;
    };
}
//# sourceMappingURL=progress.d.ts.map