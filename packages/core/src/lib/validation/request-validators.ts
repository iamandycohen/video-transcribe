/**
 * Request Validation Utilities
 */

import { Request } from 'express';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class RequestValidators {
  /**
   * Validate upload request
   */
  static validateUploadRequest(req: Request): ValidationResult {
    if (!req.file) {
      return {
        isValid: false,
        error: 'No video file uploaded'
      };
    }

    // Check file type
    if (req.file.mimetype !== 'video/mp4') {
      return {
        isValid: false,
        error: 'Only MP4 files are allowed'
      };
    }

    // Check file size (500MB limit)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (req.file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size exceeds maximum limit of 500MB'
      };
    }

    return { isValid: true };
  }

  /**
   * Validate transcription request
   */
  static validateTranscriptionRequest(req: Request): ValidationResult {
    const { uploadId, enhance, outputFormat } = req.body;

    if (!uploadId) {
      return {
        isValid: false,
        error: 'uploadId is required. Use the /upload endpoint first to upload your video file.'
      };
    }

    if (typeof uploadId !== 'string') {
      return {
        isValid: false,
        error: 'uploadId must be a string'
      };
    }

    // Validate enhance parameter if provided
    if (enhance !== undefined && typeof enhance !== 'boolean') {
      return {
        isValid: false,
        error: 'enhance parameter must be a boolean'
      };
    }

    // Validate outputFormat parameter if provided
    if (outputFormat !== undefined) {
      const validFormats = ['json', 'txt', 'both'];
      if (!validFormats.includes(outputFormat)) {
        return {
          isValid: false,
          error: `outputFormat must be one of: ${validFormats.join(', ')}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate async transcription request
   */
  static validateAsyncTranscriptionRequest(req: Request): ValidationResult {
    const baseValidation = this.validateTranscriptionRequest(req);
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const { callbackUrl } = req.body;

    // Validate callback URL if provided
    if (callbackUrl !== undefined) {
      if (typeof callbackUrl !== 'string') {
        return {
          isValid: false,
          error: 'callbackUrl must be a string'
        };
      }

      try {
        new URL(callbackUrl);
      } catch {
        return {
          isValid: false,
          error: 'callbackUrl must be a valid URL'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate upload ID format
   */
  static validateUploadId(uploadId: string): ValidationResult {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidPattern.test(uploadId)) {
      return {
        isValid: false,
        error: 'Invalid upload ID format'
      };
    }

    return { isValid: true };
  }

  /**
   * Sanitize filename for safe storage
   */
  static sanitizeFilename(filename: string): string {
    // Remove/replace dangerous characters
    return filename
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255); // Limit length
  }

  /**
   * Validate file extension
   */
  static validateFileExtension(filename: string, allowedExtensions: string[]): ValidationResult {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (!extension || !allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        error: `File extension must be one of: ${allowedExtensions.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * Extract and validate transcription options
   */
  static extractTranscriptionOptions(req: Request) {
    const { enhance = true, outputFormat = 'json' } = req.body;
    
    return {
      enhance: Boolean(enhance),
      outputFormat: outputFormat as 'json' | 'txt' | 'both'
    };
  }

  /**
   * Extract and validate async transcription options
   */
  static extractAsyncTranscriptionOptions(req: Request) {
    const baseOptions = this.extractTranscriptionOptions(req);
    const { callbackUrl } = req.body;
    
    return {
      ...baseOptions,
      callbackUrl: callbackUrl || undefined
    };
  }
}
