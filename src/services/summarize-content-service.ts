/**
 * Summarize Content Service - Atomic service for generating content summaries
 * Pure TypeScript service with no dependencies on other processing steps
 */

import { GPTEnhancementService } from './gpt-enhancement-service';
import { TranscriptionResult } from './transcription-service';
import { logger } from '../utils/logger';

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

export class SummarizeContentService {
  private gptEnhancementService: GPTEnhancementService;
  private summaries: Map<string, { summary: string; originalText: string; createdAt: Date }> = new Map();

  constructor() {
    this.gptEnhancementService = new GPTEnhancementService();
  }

  /**
   * Generate summary from text - returns summaryId and summary text
   */
  async summarizeContent(request: SummarizeContentRequest): Promise<SummarizeContentResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting content summarization for text length: ${request.text.length}`);

      if (!request.text || request.text.trim().length === 0) {
        throw new Error('No text provided for summarization');
      }

      // Create mock transcription result for GPT service
      const mockTranscription: TranscriptionResult = {
        fullText: request.text,
        segments: [],
        duration: 0,
        language: 'en-US',
        confidence: 1.0
      };

      // Get enhancement (which includes summary)
      const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);

      // Generate summaryId and store result
      const summaryId = `summary_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.summaries.set(summaryId, {
        summary: enhancementResult.summary,
        originalText: request.text,
        createdAt: new Date()
      });

      const summarizationTime = Date.now() - startTime;

      logger.info(`Content summarization completed → summaryId: ${summaryId} in ${summarizationTime}ms`);

      return {
        success: true,
        summaryId,
        originalText: request.text,
        summary: enhancementResult.summary,
        summaryLength: enhancementResult.summary.length,
        summarizationTime
      };

    } catch (error) {
      const summarizationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Content summarization failed:`, error);

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

  /**
   * Get summary by summaryId
   */
  async getSummary(summaryId: string): Promise<string | null> {
    const summaryData = this.summaries.get(summaryId);
    return summaryData ? summaryData.summary : null;
  }

  /**
   * Get service stats
   */
  getStats(): {
    activeSummaries: number;
    totalSummarized: number;
  } {
    return {
      activeSummaries: this.summaries.size,
      totalSummarized: this.summaries.size
    };
  }
}
