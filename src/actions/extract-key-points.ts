/**
 * Extract Key Points Action - Atomic operation to extract key points from text
 */

import { Request, Response } from 'express';
import { ExtractKeyPointsService } from '../services/extract-key-points-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class ExtractKeyPointsAction {
  private static extractKeyPointsService = new ExtractKeyPointsService();

  /**
   * Handle extract key points request - atomic operation
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { text, maxPoints } = req.body;
      
      if (!text) {
        ApiResponseHandler.validationError(res, 'text is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Extract key points requested for text length: ${text.length} by ${authMethod}`);

      // Call atomic service
      const result = await this.extractKeyPointsService.extractKeyPoints({
        text,
        maxPoints
      });

      if (result.success) {
        res.json({
          success: true,
          keyPointsId: result.keyPointsId,
          originalText: result.originalText,
          keyPoints: result.keyPoints,
          extractionTime: result.extractionTime,
          message: `Extracted ${result.keyPoints.length} key points successfully.`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          extractionTime: result.extractionTime
        });
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Extract key points');
    }
  }

  /**
   * Get service stats
   */
  static getStats() {
    return this.extractKeyPointsService.getStats();
  }
}
