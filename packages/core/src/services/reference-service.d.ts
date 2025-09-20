export interface FileReference {
    url: string;
    filePath: string;
    originalName: string;
    mimeType: string;
    size: number;
    created_at: string;
}
export declare class ReferenceService {
    private tempDir;
    private baseUrl;
    constructor(tempDir?: string, baseUrl?: string);
    private ensureTempDirectory;
    storeVideo(buffer: Buffer, originalName: string, workflow_id: string): Promise<string>;
    storeAudio(buffer: Buffer, workflow_id: string): Promise<string>;
    getFilePathFromUrl(url: string): string;
    getFileBuffer(url: string): Promise<Buffer>;
    getFileStream(url: string): Promise<{
        stream: Buffer;
        stats: any;
    }>;
    exists(url: string): Promise<boolean>;
    getFileInfo(url: string): Promise<FileReference | null>;
    cleanup(url: string): Promise<{
        success: boolean;
        spaceFreed: number;
    }>;
    storeFromPath(filePath: string, workflow_id: string): Promise<string>;
    storeFromUrl(sourceUrl: string, workflow_id: string): Promise<string>;
    storeFromUrlWithProgress(sourceUrl: string, workflow_id: string, onProgress?: (downloaded: number, total: number, percentage: number) => void, cancellationToken?: AbortSignal): Promise<string>;
    cleanupWorkflow(workflow_id: string): Promise<{
        filesDeleted: number;
        spaceFreed: number;
    }>;
    private getMimeType;
    private getFileNameFromUrl;
    getStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        videoFiles: number;
        audioFiles: number;
    }>;
}
//# sourceMappingURL=reference-service.d.ts.map