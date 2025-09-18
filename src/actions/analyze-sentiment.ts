/**
 * Analyze Sentiment Action - Atomic operation to analyze text sentiment
 */

import { Request, Response } from 'express';
import { AnalyzeSentimentService } from '../services/analyze-sentiment-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class AnalyzeSentimentAction {
  private static analyzeSentimentService = new AnalyzeSentimentService();

  /**
   * Handle analyze sentiment request - atomic operation
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { text } = req.body;
      
      if (!text) {
        ApiResponseHandler.validationError(res, 'text is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Analyze sentiment requested for text length: ${text.length} by ${authMethod}`);

      // Call atomic service
      const result = await this.analyzeSentimentService.analyzeSentiment({
        text
      });

      if (result.success) {
        res.json({
          success: true,
          sentimentId: result.sentimentId,
          originalText: result.originalText,
          sentiment: result.sentiment,
          confidence: result.confidence,
          analysisTime: result.analysisTime,
          message: `Sentiment analysis completed: ${result.sentiment} (${Math.round(result.confidence * 100)}% confidence).`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          analysisTime: result.analysisTime
        });
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Analyze sentiment');
    }
  }

  /**
   * Get service stats
   */
  static getStats() {
    return this.analyzeSentimentService.getStats();
  }
}
