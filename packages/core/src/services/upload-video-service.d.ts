export interface UploadedVideo {
    uploadId: string;
    originalName: string;
    filePath: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
    expiresAt: Date;
}
export interface UploadVideoOptions {
    tempDir?: string;
    expirationHours?: number;
}
export interface UploadVideoResult {
    uploadId: string;
    originalName: string;
    size: number;
    uploadedAt: string;
    expiresAt: string;
    message: string;
}
export declare class UploadVideoService {
    private uploads;
    private tempDir;
    private defaultExpirationHours;
    constructor(options?: UploadVideoOptions);
    private ensureTempDirectory;
    storeVideo(file: {
        originalname: string;
        path: string;
        mimetype: string;
        size: number;
    }): Promise<UploadVideoResult>;
    storeVideoFromPath(filePath: string): Promise<UploadVideoResult>;
    storeVideoFromUrl(url: string): Promise<UploadVideoResult>;
    getUploadedVideo(uploadId: string): Promise<UploadedVideo | null>;
    deleteUploadedVideo(uploadId: string): Promise<boolean>;
    cleanupExpiredUploads(): Promise<number>;
    getStats(): {
        totalUploads: number;
        activeUploads: number;
        totalSize: number;
    };
}
//# sourceMappingURL=upload-video-service.d.ts.map