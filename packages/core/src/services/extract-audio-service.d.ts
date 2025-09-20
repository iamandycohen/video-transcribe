import { UploadVideoService } from './upload-video-service';
export interface ExtractAudioRequest {
    uploadId: string;
}
export interface ExtractAudioFromPathRequest {
    filePath: string;
    originalName: string;
    uploadId: string;
}
export interface ExtractAudioResult {
    success: boolean;
    audioId: string;
    audioFilePath: string;
    originalVideoName: string;
    extractionTime: number;
    error?: string;
}
export declare class ExtractAudioService {
    private audioExtractor;
    private uploadService;
    private audioFiles;
    constructor(uploadService?: UploadVideoService);
    extractAudio(request: ExtractAudioRequest): Promise<ExtractAudioResult>;
    extractAudioFromPath(request: ExtractAudioFromPathRequest): Promise<ExtractAudioResult>;
    getAudioFile(audioId: string): Promise<{
        filePath: string;
        originalVideoName: string;
    } | null>;
    cleanupAudio(audioId: string): Promise<boolean>;
    getStats(): {
        activeAudioFiles: number;
        totalExtracted: number;
    };
}
//# sourceMappingURL=extract-audio-service.d.ts.map