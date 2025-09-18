/**
 * Enhance Transcription Action - Atomic operation to enhance raw text with GPT
 */

import { Request, Response } from 'express';
import { EnhanceTranscriptionService } from '../services/enhance-transcription-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class EnhanceTranscriptionAction {
  private static enhanceTranscriptionService = new EnhanceTranscriptionService();

  /**
   * Handle enhance transcription request - atomic operation
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { text, language } = req.body;
      
      if (!text) {
        ApiResponseHandler.validationError(res, 'text is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Enhance transcription requested for text length: ${text.length} by ${authMethod}`);

      // Call atomic service
      const result = await this.enhanceTranscriptionService.enhanceTranscription({
        text,
        language
      });

      if (result.success) {
        res.json({
          success: true,
          enhancementId: result.enhancementId,
          originalText: result.originalText,
          enhancedText: result.enhancedText,
          enhancementTime: result.enhancementTime,
          message: 'Transcription enhanced successfully. Use enhancementId or enhancedText for further processing.'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          enhancementTime: result.enhancementTime
        });
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Enhance transcription');
    }
  }

  /**
   * Get service stats
   */
  static getStats() {
    return this.enhanceTranscriptionService.getStats();
  }
}
