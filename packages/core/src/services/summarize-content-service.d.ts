export interface SummarizeContentRequest {
    text: string;
    maxLength?: number;
    style?: 'brief' | 'detailed' | 'bullet-points';
}
export interface SummarizeContentResult {
    success: boolean;
    summaryId: string;
    originalText: string;
    summary: string;
    summaryLength: number;
    summarizationTime: number;
    error?: string;
}
export declare class SummarizeContentService {
    private gptEnhancementService;
    private summaries;
    constructor();
    summarizeContent(request: SummarizeContentRequest): Promise<SummarizeContentResult>;
    getSummary(summaryId: string): Promise<string | null>;
    getStats(): {
        activeSummaries: number;
        totalSummarized: number;
    };
}
//# sourceMappingURL=summarize-content-service.d.ts.map