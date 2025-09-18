/**
 * Summarize Content Action - Atomic operation to generate content summaries
 */

import { Request, Response } from 'express';
import { SummarizeContentService } from '../services/summarize-content-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class SummarizeContentAction {
  private static summarizeContentService = new SummarizeContentService();

  /**
   * Handle summarize content request - atomic operation
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { text, maxLength, style } = req.body;
      
      if (!text) {
        ApiResponseHandler.validationError(res, 'text is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Summarize content requested for text length: ${text.length} by ${authMethod}`);

      // Call atomic service
      const result = await this.summarizeContentService.summarizeContent({
        text,
        maxLength,
        style
      });

      if (result.success) {
        res.json({
          success: true,
          summaryId: result.summaryId,
          originalText: result.originalText,
          summary: result.summary,
          summaryLength: result.summaryLength,
          summarizationTime: result.summarizationTime,
          message: 'Content summarized successfully.'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          summarizationTime: result.summarizationTime
        });
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Summarize content');
    }
  }

  /**
   * Get service stats
   */
  static getStats() {
    return this.summarizeContentService.getStats();
  }
}
