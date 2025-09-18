/**
 * Upload Video Action - Thin wrapper that handles HTTP concerns and calls core service
 */

import { Request, Response } from 'express';
import { UploadVideoService } from '../services/upload-video-service';
import { RequestValidators } from '../lib/validation/request-validators';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';

export class UploadVideoAction {
  private static uploadService = new UploadVideoService({
    tempDir: './temp/uploads',
    expirationHours: 24
  });

  /**
   * Handle video upload request - thin wrapper around UploadVideoService
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      // Validate request (HTTP concern)
      const validation = RequestValidators.validateUploadRequest(req);
      if (!validation.isValid) {
        ApiResponseHandler.validationError(res, validation.error!);
        return;
      }

      const file = req.file!;
      const authMethod = AuthUtils.getAuthMethod(req);

      // Call core service (business logic)
      const result = await this.uploadService.storeVideo({
        originalname: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      });

      logger.info(`Video uploaded successfully: ${result.uploadId} (${file.originalname}) by ${authMethod}`);

      // Return HTTP response (HTTP concern)
      ApiResponseHandler.uploadSuccess(res, result);

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Upload video');
    }
  }

  /**
   * Get upload service stats (for monitoring)
   */
  static getStats() {
    return this.uploadService.getStats();
  }

  /**
   * Clean up expired uploads
   */
  static async cleanupExpired(): Promise<number> {
    return await this.uploadService.cleanupExpiredUploads();
  }
}
