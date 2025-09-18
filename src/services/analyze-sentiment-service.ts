/**
 * Analyze Sentiment Service - Atomic service for analyzing text sentiment
 * Pure TypeScript service with no dependencies on other processing steps
 */

import { GPTEnhancementService } from './gpt-enhancement-service';
import { TranscriptionResult } from './transcription-service';
import { logger } from '../utils/logger';

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

export class AnalyzeSentimentService {
  private gptEnhancementService: GPTEnhancementService;
  private sentimentData: Map<string, { sentiment: string; confidence: number; originalText: string; createdAt: Date }> = new Map();

  constructor() {
    this.gptEnhancementService = new GPTEnhancementService();
  }

  /**
   * Analyze sentiment of text - returns sentimentId and sentiment analysis
   */
  async analyzeSentiment(request: AnalyzeSentimentRequest): Promise<AnalyzeSentimentResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting sentiment analysis for text length: ${request.text.length}`);

      if (!request.text || request.text.trim().length === 0) {
        throw new Error('No text provided for sentiment analysis');
      }

      // Create mock transcription result for GPT service
      const mockTranscription: TranscriptionResult = {
        fullText: request.text,
        segments: [],
        duration: 0,
        language: 'en-US',
        confidence: 1.0
      };

      // Get enhancement (which includes sentiment)
      const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);

      // Parse sentiment and confidence
      const sentiment = enhancementResult.sentiment as 'positive' | 'neutral' | 'negative';
      const confidence = enhancementResult.confidence;

      // Generate sentimentId and store result
      const sentimentId = `sentiment_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.sentimentData.set(sentimentId, {
        sentiment,
        confidence,
        originalText: request.text,
        createdAt: new Date()
      });

      const analysisTime = Date.now() - startTime;

      logger.info(`Sentiment analysis completed → sentimentId: ${sentimentId} (${sentiment}) in ${analysisTime}ms`);

      return {
        success: true,
        sentimentId,
        originalText: request.text,
        sentiment,
        confidence,
        analysisTime
      };

    } catch (error) {
      const analysisTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Sentiment analysis failed:`, error);

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

  /**
   * Get sentiment by sentimentId
   */
  async getSentiment(sentimentId: string): Promise<{ sentiment: string; confidence: number } | null> {
    const sentimentData = this.sentimentData.get(sentimentId);
    return sentimentData ? { sentiment: sentimentData.sentiment, confidence: sentimentData.confidence } : null;
  }

  /**
   * Get service stats
   */
  getStats(): {
    activeSentiments: number;
    totalAnalyzed: number;
  } {
    return {
      activeSentiments: this.sentimentData.size,
      totalAnalyzed: this.sentimentData.size
    };
  }
}
