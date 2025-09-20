import { ProgressCallback } from '../types/progress';
export interface AudioExtractionResult {
    audioFilePath: string;
    duration: number;
    format: string;
}
export declare class AudioExtractorService {
    private tempDir;
    constructor();
    private ensureTempDirectory;
    extractAudioFromMp4(mp4FilePath: string, onProgress?: ProgressCallback): Promise<AudioExtractionResult>;
    cleanup(audioFilePath: string): Promise<void>;
    validateMp4File(filePath: string): Promise<boolean>;
}
//# sourceMappingURL=audio-extractor.d.ts.map