"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractKeyPointsService = void 0;
const gpt_enhancement_service_1 = require("./gpt-enhancement-service");
const logger_1 = require("../utils/logger");
class ExtractKeyPointsService {
    gptEnhancementService;
    keyPointsData = new Map();
    constructor() {
        this.gptEnhancementService = new gpt_enhancement_service_1.GPTEnhancementService();
    }
    async extractKeyPoints(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Starting key points extraction for text length: ${request.text.length}`);
            if (!request.text || request.text.trim().length === 0) {
                throw new Error('No text provided for key points extraction');
            }
            const mockTranscription = {
                fullText: request.text,
                segments: [],
                duration: 0,
                language: 'en-US',
                confidence: 1.0
            };
            const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);
            let keyPoints = enhancementResult.keyPoints;
            if (request.maxPoints && keyPoints.length > request.maxPoints) {
                keyPoints = keyPoints.slice(0, request.maxPoints);
            }
            const keyPointsId = `keypoints_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            this.keyPointsData.set(keyPointsId, {
                keyPoints,
                originalText: request.text,
                createdAt: new Date()
            });
            const extractionTime = Date.now() - startTime;
            logger_1.logger.info(`Key points extraction completed → keyPointsId: ${keyPointsId} (${keyPoints.length} points) in ${extractionTime}ms`);
            return {
                success: true,
                keyPointsId,
                originalText: request.text,
                keyPoints,
                extractionTime
            };
        }
        catch (error) {
            const extractionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Key points extraction failed:`, error);
            return {
                success: false,
                keyPointsId: '',
                originalText: request.text,
                keyPoints: [],
                extractionTime,
                error: errorMessage
            };
        }
    }
    async getKeyPoints(keyPointsId) {
        const keyPointsData = this.keyPointsData.get(keyPointsId);
        return keyPointsData ? keyPointsData.keyPoints : null;
    }
    getStats() {
        return {
            activeKeyPoints: this.keyPointsData.size,
            totalExtracted: this.keyPointsData.size
        };
    }
}
exports.ExtractKeyPointsService = ExtractKeyPointsService;
//# sourceMappingURL=extract-key-points-service.js.map