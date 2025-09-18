/**
 * Extract Audio Action - Atomic operation to extract audio from uploaded video
 */

import { Request, Response } from 'express';
import { ExtractAudioService } from '../services/extract-audio-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class ExtractAudioAction {
  private static extractAudioService = new ExtractAudioService();

  /**
   * Handle extract audio request - atomic operation
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { uploadId } = req.body;
      
      if (!uploadId) {
        ApiResponseHandler.validationError(res, 'uploadId is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Extract audio requested for uploadId: ${uploadId} by ${authMethod}`);

      // Call atomic service
      const result = await this.extractAudioService.extractAudio({ uploadId });

      if (result.success) {
        res.json({
          success: true,
          audioId: result.audioId,
          audioFilePath: result.audioFilePath,
          originalVideoName: result.originalVideoName,
          extractionTime: result.extractionTime,
          message: 'Audio extracted successfully. Use audioId for transcription.'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          extractionTime: result.extractionTime
        });
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Extract audio');
    }
  }

  /**
   * Get service stats
   */
  static getStats() {
    return this.extractAudioService.getStats();
  }
}
