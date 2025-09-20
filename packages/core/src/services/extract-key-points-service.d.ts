export interface ExtractKeyPointsRequest {
    text: string;
    maxPoints?: number;
}
export interface ExtractKeyPointsResult {
    success: boolean;
    keyPointsId: string;
    originalText: string;
    keyPoints: string[];
    extractionTime: number;
    error?: string;
}
export declare class ExtractKeyPointsService {
    private gptEnhancementService;
    private keyPointsData;
    constructor();
    extractKeyPoints(request: ExtractKeyPointsRequest): Promise<ExtractKeyPointsResult>;
    getKeyPoints(keyPointsId: string): Promise<string[] | null>;
    getStats(): {
        activeKeyPoints: number;
        totalExtracted: number;
    };
}
//# sourceMappingURL=extract-key-points-service.d.ts.map