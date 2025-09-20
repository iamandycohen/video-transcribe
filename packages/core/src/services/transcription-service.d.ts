export interface TranscriptionSegment {
    text: string;
    startTime: number;
    endTime: number;
    confidence: number;
}
export interface TranscriptionResult {
    fullText: string;
    segments: TranscriptionSegment[];
    duration: number;
    language: string;
    confidence: number;
}
export declare class TranscriptionService {
    private azureClient;
    constructor();
    transcribeAudioFile(audioFilePath: string): Promise<TranscriptionResult>;
    private extractConfidence;
    transcribeWithDiarization(audioFilePath: string): Promise<TranscriptionResult>;
}
//# sourceMappingURL=transcription-service.d.ts.map