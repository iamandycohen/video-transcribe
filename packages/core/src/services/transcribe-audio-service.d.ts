import { TranscriptionResult } from './transcription-service';
export interface TranscribeAudioRequest {
    audioId: string;
    audioFilePath: string;
}
export interface TranscribeAudioResult {
    success: boolean;
    transcriptionId: string;
    rawText: string;
    segments: Array<{
        text: string;
        startTime: number;
        endTime: number;
        confidence: number;
    }>;
    language: string;
    confidence: number;
    duration: number;
    transcriptionTime: number;
    error?: string;
}
export declare class TranscribeAudioService {
    private transcriptionService;
    private transcriptions;
    constructor();
    transcribeAudio(request: TranscribeAudioRequest): Promise<TranscribeAudioResult>;
    getTranscription(transcriptionId: string): Promise<TranscriptionResult | null>;
    getRawText(transcriptionId: string): Promise<string | null>;
    getStats(): {
        activeTranscriptions: number;
        totalTranscribed: number;
    };
}
//# sourceMappingURL=transcribe-audio-service.d.ts.map