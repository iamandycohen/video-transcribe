/**
 * Identify Topics Service - Atomic service for identifying topics in text
 * Pure TypeScript service with no dependencies on other processing steps
 */

import { GPTEnhancementService } from './gpt-enhancement-service';
import { TranscriptionResult } from './transcription-service';
import { logger } from '../utils/logger';

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

export class IdentifyTopicsService {
  private gptEnhancementService: GPTEnhancementService;
  private topicsData: Map<string, { topics: string[]; originalText: string; createdAt: Date }> = new Map();

  constructor() {
    this.gptEnhancementService = new GPTEnhancementService();
  }

  /**
   * Identify topics in text - returns topicsId and topics array
   */
  async identifyTopics(request: IdentifyTopicsRequest): Promise<IdentifyTopicsResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting topic identification for text length: ${request.text.length}`);

      if (!request.text || request.text.trim().length === 0) {
        throw new Error('No text provided for topic identification');
      }

      // Create mock transcription result for GPT service
      const mockTranscription: TranscriptionResult = {
        fullText: request.text,
        segments: [],
        duration: 0,
        language: 'en-US',
        confidence: 1.0
      };

      // Get enhancement (which includes topics)
      const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);

      // Limit topics if requested
      let topics = enhancementResult.topics;
      if (request.maxTopics && topics.length > request.maxTopics) {
        topics = topics.slice(0, request.maxTopics);
      }

      // Generate topicsId and store result
      const topicsId = `topics_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.topicsData.set(topicsId, {
        topics,
        originalText: request.text,
        createdAt: new Date()
      });

      const identificationTime = Date.now() - startTime;

      logger.info(`Topic identification completed → topicsId: ${topicsId} (${topics.length} topics) in ${identificationTime}ms`);

      return {
        success: true,
        topicsId,
        originalText: request.text,
        topics,
        identificationTime
      };

    } catch (error) {
      const identificationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Topic identification failed:`, error);

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

  /**
   * Get topics by topicsId
   */
  async getTopics(topicsId: string): Promise<string[] | null> {
    const topicsData = this.topicsData.get(topicsId);
    return topicsData ? topicsData.topics : null;
  }

  /**
   * Get service stats
   */
  getStats(): {
    activeTopics: number;
    totalIdentified: number;
  } {
    return {
      activeTopics: this.topicsData.size,
      totalIdentified: this.topicsData.size
    };
  }
}
