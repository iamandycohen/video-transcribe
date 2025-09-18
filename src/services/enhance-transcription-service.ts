/**
 * Enhance Transcription Service - Atomic service for enhancing raw text with GPT
 * Pure TypeScript service with no dependencies on other processing steps
 */

import { GPTEnhancementService, EnhancedTranscription } from './gpt-enhancement-service';
import { TranscriptionResult } from './transcription-service';
import { logger } from '../utils/logger';

export interface EnhanceTranscriptionRequest {
  text: string;
  language?: string;
}

export interface EnhanceTranscriptionResult {
  success: boolean;
  enhancementId: string;
  originalText: string;
  enhancedText: string;
  enhancementTime: number;
  error?: string;
}

export class EnhanceTranscriptionService {
  private gptEnhancementService: GPTEnhancementService;
  private enhancements: Map<string, EnhancedTranscription> = new Map();

  constructor() {
    this.gptEnhancementService = new GPTEnhancementService();
  }

  /**
   * Enhance raw transcription text with GPT - returns enhancementId and enhanced text
   */
  async enhanceTranscription(request: EnhanceTranscriptionRequest): Promise<EnhanceTranscriptionResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting transcription enhancement for text length: ${request.text.length}`);

      if (!request.text || request.text.trim().length === 0) {
        throw new Error('No text provided for enhancement');
      }

      // Create mock transcription result for GPT service
      const mockTranscription: TranscriptionResult = {
        fullText: request.text,
        segments: [],
        duration: 0,
        language: request.language || 'en-US',
        confidence: 1.0
      };

      // Enhance with GPT
      const enhancementResult: EnhancedTranscription = await this.gptEnhancementService.enhanceTranscription(mockTranscription);

      // Generate enhancementId and store result
      const enhancementId = `enhancement_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.enhancements.set(enhancementId, enhancementResult);

      const enhancementTime = Date.now() - startTime;

      logger.info(`Transcription enhancement completed → enhancementId: ${enhancementId} in ${enhancementTime}ms`);

      return {
        success: true,
        enhancementId,
        originalText: enhancementResult.originalText,
        enhancedText: enhancementResult.enhancedText,
        enhancementTime
      };

    } catch (error) {
      const enhancementTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Transcription enhancement failed:`, error);

      return {
        success: false,
        enhancementId: '',
        originalText: request.text,
        enhancedText: '',
        enhancementTime,
        error: errorMessage
      };
    }
  }

  /**
   * Get enhancement result by enhancementId
   */
  async getEnhancement(enhancementId: string): Promise<EnhancedTranscription | null> {
    return this.enhancements.get(enhancementId) || null;
  }

  /**
   * Get enhanced text from enhancementId
   */
  async getEnhancedText(enhancementId: string): Promise<string | null> {
    const enhancement = this.enhancements.get(enhancementId);
    return enhancement ? enhancement.enhancedText : null;
  }

  /**
   * Get service stats
   */
  getStats(): {
    activeEnhancements: number;
    totalEnhanced: number;
  } {
    return {
      activeEnhancements: this.enhancements.size,
      totalEnhanced: this.enhancements.size
    };
  }
}
