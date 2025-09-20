"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzeSentimentService = void 0;
const gpt_enhancement_service_1 = require("./gpt-enhancement-service");
const logger_1 = require("../utils/logger");
class AnalyzeSentimentService {
    gptEnhancementService;
    sentimentData = new Map();
    constructor() {
        this.gptEnhancementService = new gpt_enhancement_service_1.GPTEnhancementService();
    }
    async analyzeSentiment(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Starting sentiment analysis for text length: ${request.text.length}`);
            if (!request.text || request.text.trim().length === 0) {
                throw new Error('No text provided for sentiment analysis');
            }
            const mockTranscription = {
                fullText: request.text,
                segments: [],
                duration: 0,
                language: 'en-US',
                confidence: 1.0
            };
            const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);
            const sentiment = enhancementResult.sentiment;
            const confidence = enhancementResult.confidence;
            const sentimentId = `sentiment_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            this.sentimentData.set(sentimentId, {
                sentiment,
                confidence,
                originalText: request.text,
                createdAt: new Date()
            });
            const analysisTime = Date.now() - startTime;
            logger_1.logger.info(`Sentiment analysis completed → sentimentId: ${sentimentId} (${sentiment}) in ${analysisTime}ms`);
            return {
                success: true,
                sentimentId,
                originalText: request.text,
                sentiment,
                confidence,
                analysisTime
            };
        }
        catch (error) {
            const analysisTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Sentiment analysis failed:`, error);
            return {
                success: false,
                sentimentId: '',
                originalText: request.text,
                sentiment: 'neutral',
                confidence: 0,
                analysisTime,
                error: errorMessage
            };
        }
    }
    async getSentiment(sentimentId) {
        const sentimentData = this.sentimentData.get(sentimentId);
        return sentimentData ? { sentiment: sentimentData.sentiment, confidence: sentimentData.confidence } : null;
    }
    getStats() {
        return {
            activeSentiments: this.sentimentData.size,
            totalAnalyzed: this.sentimentData.size
        };
    }
}
exports.AnalyzeSentimentService = AnalyzeSentimentService;
//# sourceMappingURL=analyze-sentiment-service.js.map