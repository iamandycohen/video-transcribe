export interface AnalyzeSentimentRequest {
    text: string;
}
export interface AnalyzeSentimentResult {
    success: boolean;
    sentimentId: string;
    originalText: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    analysisTime: number;
    error?: string;
}
export declare class AnalyzeSentimentService {
    private gptEnhancementService;
    private sentimentData;
    constructor();
    analyzeSentiment(request: AnalyzeSentimentRequest): Promise<AnalyzeSentimentResult>;
    getSentiment(sentimentId: string): Promise<{
        sentiment: string;
        confidence: number;
    } | null>;
    getStats(): {
        activeSentiments: number;
        totalAnalyzed: number;
    };
}
//# sourceMappingURL=analyze-sentiment-service.d.ts.map