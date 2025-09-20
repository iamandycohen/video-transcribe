export interface IdentifyTopicsRequest {
    text: string;
    maxTopics?: number;
}
export interface IdentifyTopicsResult {
    success: boolean;
    topicsId: string;
    originalText: string;
    topics: string[];
    identificationTime: number;
    error?: string;
}
export declare class IdentifyTopicsService {
    private gptEnhancementService;
    private topicsData;
    constructor();
    identifyTopics(request: IdentifyTopicsRequest): Promise<IdentifyTopicsResult>;
    getTopics(topicsId: string): Promise<string[] | null>;
    getStats(): {
        activeTopics: number;
        totalIdentified: number;
    };
}
//# sourceMappingURL=identify-topics-service.d.ts.map