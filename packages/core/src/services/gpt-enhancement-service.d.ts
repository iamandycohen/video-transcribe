import { TranscriptionResult } from './transcription-service';
export interface EnhancedTranscription {
    originalText: string;
    enhancedText: string;
    summary: string;
    keyPoints: string[];
    topics: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
}
export declare class GPTEnhancementService {
    private openaiClient;
    constructor();
    enhanceTranscription(transcription: TranscriptionResult): Promise<EnhancedTranscription>;
    private improveTranscriptionText;
    private generateSummary;
    private extractKeyPoints;
    private identifyTopics;
    private analyzeSentiment;
}
//# sourceMappingURL=gpt-enhancement-service.d.ts.map