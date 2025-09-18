/**
 * Transcribe Audio Action - Atomic operation to transcribe audio to text
 */

import { Request, Response } from 'express';
import { TranscribeAudioService } from '../services/transcribe-audio-service';
import { ExtractAudioService } from '../services/extract-audio-service';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class TranscribeAudioAction {
  private static transcribeAudioService = new TranscribeAudioService();
  private static extractAudioService = new ExtractAudioService();

  /**
   * Handle transcribe audio request - atomic operation
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { audioId } = req.body;
      
      if (!audioId) {
        ApiResponseHandler.validationError(res, 'audioId is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Transcribe audio requested for audioId: ${audioId} by ${authMethod}`);

      // Get audio file path
      const audioFile = await this.extractAudioService.getAudioFile(audioId);
      if (!audioFile) {
        res.status(404).json({
          success: false,
          error: 'Audio ID not found or expired'
        });
        return;
      }

      // Call atomic service
      const result = await this.transcribeAudioService.transcribeAudio({
        audioId,
        audioFilePath: audioFile.filePath
      });

      if (result.success) {
        res.json({
          success: true,
          transcriptionId: result.transcriptionId,
          rawText: result.rawText,
          segments: result.segments,
          language: result.language,
          confidence: result.confidence,
          duration: result.duration,
          transcriptionTime: result.transcriptionTime,
          message: 'Audio transcribed successfully. Use transcriptionId or rawText for further processing.'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          transcriptionTime: result.transcriptionTime
        });
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Transcribe audio');
    }
  }

  /**
   * Get service stats
   */
  static getStats() {
    return this.transcribeAudioService.getStats();
  }
}
