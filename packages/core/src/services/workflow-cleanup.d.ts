export interface CleanupResult {
    success: boolean;
    fileDeleted?: string;
    spaceFreed?: number;
    error?: string;
}
export declare class WorkflowCleanupService {
    private tempDir;
    constructor(tempDir?: string);
    cleanupVideoAfterAudioExtraction(uploadId: string): Promise<CleanupResult>;
    cleanupAudioAfterTranscription(audioId: string): Promise<CleanupResult>;
    cleanupCompleteWorkflow(uploadId: string, audioId?: string): Promise<{
        videoCleanup: CleanupResult;
        audioCleanup?: CleanupResult;
    }>;
    getWorkflowStats(): Promise<{
        activeVideos: number;
        activeAudioFiles: number;
        totalVideoSize: number;
        totalAudioSize: number;
    }>;
}
//# sourceMappingURL=workflow-cleanup.d.ts.map