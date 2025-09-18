/**
 * Extract Key Points Service - Atomic service for extracting key points from text
 * Pure TypeScript service with no dependencies on other processing steps
 */

import { GPTEnhancementService } from './gpt-enhancement-service';
import { TranscriptionResult } from './transcription-service';
import { logger } from '../utils/logger';

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

export class ExtractKeyPointsService {
  private gptEnhancementService: GPTEnhancementService;
  private keyPointsData: Map<string, { keyPoints: string[]; originalText: string; createdAt: Date }> = new Map();

  constructor() {
    this.gptEnhancementService = new GPTEnhancementService();
  }

  /**
   * Extract key points from text - returns keyPointsId and key points array
   */
  async extractKeyPoints(request: ExtractKeyPointsRequest): Promise<ExtractKeyPointsResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting key points extraction for text length: ${request.text.length}`);

      if (!request.text || request.text.trim().length === 0) {
        throw new Error('No text provided for key points extraction');
      }

      // Create mock transcription result for GPT service
      const mockTranscription: TranscriptionResult = {
        fullText: request.text,
        segments: [],
        duration: 0,
        language: 'en-US',
        confidence: 1.0
      };

      // Get enhancement (which includes key points)
      const enhancementResult = await this.gptEnhancementService.enhanceTranscription(mockTranscription);

      // Limit key points if requested
      let keyPoints = enhancementResult.keyPoints;
      if (request.maxPoints && keyPoints.length > request.maxPoints) {
        keyPoints = keyPoints.slice(0, request.maxPoints);
      }

      // Generate keyPointsId and store result
      const keyPointsId = `keypoints_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.keyPointsData.set(keyPointsId, {
        keyPoints,
        originalText: request.text,
        createdAt: new Date()
      });

      const extractionTime = Date.now() - startTime;

      logger.info(`Key points extraction completed → keyPointsId: ${keyPointsId} (${keyPoints.length} points) in ${extractionTime}ms`);

      return {
        success: true,
        keyPointsId,
        originalText: request.text,
        keyPoints,
        extractionTime
      };

    } catch (error) {
      const extractionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Key points extraction failed:`, error);

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

  /**
   * Get key points by keyPointsId
   */
  async getKeyPoints(keyPointsId: string): Promise<string[] | null> {
    const keyPointsData = this.keyPointsData.get(keyPointsId);
    return keyPointsData ? keyPointsData.keyPoints : null;
  }

  /**
   * Get service stats
   */
  getStats(): {
    activeKeyPoints: number;
    totalExtracted: number;
  } {
    return {
      activeKeyPoints: this.keyPointsData.size,
      totalExtracted: this.keyPointsData.size
    };
  }
}
