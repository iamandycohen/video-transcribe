"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentifyTopicsService = void 0;
const gpt_enhancement_service_1 = require("./gpt-enhancement-service");
const logger_1 = require("../utils/logger");
class IdentifyTopicsService {
    gptEnhancementService;
    topicsData = new Map();
    constructor() {
        this.gptEnhancementService = new gpt_enhancement_service_1.GPTEnhancementService();
    }
    async identifyTopics(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Starting topic identification for text length: ${request.text.length}`);
            if (!request.text || request.text.trim().length === 0) {
                throw new Error('No text provided for topic identification');
            }
            const mockTranscription = {
                fullText: request.text,
                segments: [],
                duration: 0,
                language: 'en-US',
                confidence: 1.0
            };
            const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);
            let topics = enhancementResult.topics;
            if (request.maxTopics && topics.length > request.maxTopics) {
                topics = topics.slice(0, request.maxTopics);
            }
            const topicsId = `topics_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            this.topicsData.set(topicsId, {
                topics,
                originalText: request.text,
                createdAt: new Date()
            });
            const identificationTime = Date.now() - startTime;
            logger_1.logger.info(`Topic identification completed → topicsId: ${topicsId} (${topics.length} topics) in ${identificationTime}ms`);
            return {
                success: true,
                topicsId,
                originalText: request.text,
                topics,
                identificationTime
            };
        }
        catch (error) {
            const identificationTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Topic identification failed:`, error);
            return {
                success: false,
                topicsId: '',
                originalText: request.text,
                topics: [],
                identificationTime,
                error: errorMessage
            };
        }
    }
    async getTopics(topicsId) {
        const topicsData = this.topicsData.get(topicsId);
        return topicsData ? topicsData.topics : null;
    }
    getStats() {
        return {
            activeTopics: this.topicsData.size,
            totalIdentified: this.topicsData.size
        };
    }
}
exports.IdentifyTopicsService = IdentifyTopicsService;
//# sourceMappingURL=identify-topics-service.js.map