"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummarizeContentService = void 0;
const gpt_enhancement_service_1 = require("./gpt-enhancement-service");
const logger_1 = require("../utils/logger");
class SummarizeContentService {
    gptEnhancementService;
    summaries = new Map();
    constructor() {
        this.gptEnhancementService = new gpt_enhancement_service_1.GPTEnhancementService();
    }
    async summarizeContent(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Starting content summarization for text length: ${request.text.length}`);
            if (!request.text || request.text.trim().length === 0) {
                throw new Error('No text provided for summarization');
            }
            const mockTranscription = {
                fullText: request.text,
                segments: [],
                duration: 0,
                language: 'en-US',
                confidence: 1.0
            };
            const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);
            const summaryId = `summary_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            this.summaries.set(summaryId, {
                summary: enhancementResult.summary,
                originalText: request.text,
                createdAt: new Date()
            });
            const summarizationTime = Date.now() - startTime;
            logger_1.logger.info(`Content summarization completed → summaryId: ${summaryId} in ${summarizationTime}ms`);
            return {
                success: true,
                summaryId,
                originalText: request.text,
                summary: enhancementResult.summary,
                summaryLength: enhancementResult.summary.length,
                summarizationTime
            };
        }
        catch (error) {
            const summarizationTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Content summarization failed:`, error);
            return {
                success: false,
                summaryId: '',
                originalText: request.text,
                summary: '',
                summaryLength: 0,
                summarizationTime,
                error: errorMessage
            };
        }
    }
    async getSummary(summaryId) {
        const summaryData = this.summaries.get(summaryId);
        return summaryData ? summaryData.summary : null;
    }
    getStats() {
        return {
            activeSummaries: this.summaries.size,
            totalSummarized: this.summaries.size
        };
    }
}
exports.SummarizeContentService = SummarizeContentService;
//# sourceMappingURL=summarize-content-service.js.map