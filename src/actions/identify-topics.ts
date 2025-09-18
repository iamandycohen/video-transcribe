/**
 * Identify Topics Action - Atomic operation to identify topics in text
 */

import { Request, Response } from 'express';
import { IdentifyTopicsService } from '../services/identify-topics-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class IdentifyTopicsAction {
  private static identifyTopicsService = new IdentifyTopicsService();

  /**
   * Handle identify topics request - atomic operation
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { text, maxTopics } = req.body;
      
      if (!text) {
        ApiResponseHandler.validationError(res, 'text is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Identify topics requested for text length: ${text.length} by ${authMethod}`);

      // Call atomic service
      const result = await this.identifyTopicsService.identifyTopics({
        text,
        maxTopics
      });

      if (result.success) {
        res.json({
          success: true,
          topicsId: result.topicsId,
          originalText: result.originalText,
          topics: result.topics,
          identificationTime: result.identificationTime,
          message: `Identified ${result.topics.length} topics successfully.`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          identificationTime: result.identificationTime
        });
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Identify topics');
    }
  }

  /**
   * Get service stats
   */
  static getStats() {
    return this.identifyTopicsService.getStats();
  }
}
