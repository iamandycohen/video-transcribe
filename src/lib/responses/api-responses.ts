/**
 * API Response Utilities - Standardized response formatting
 */

import { Response } from 'express';
import { logger } from '../../utils/logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface UploadResponse {
  uploadId: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  expiresAt: string;
  message: string;
}

export interface TranscriptionResponse {
  success: boolean;
  transcription: string;
  summary?: string;
  keyPoints?: string[];
  topics?: string[];
  sentiment?: string;
  outputFiles?: string[];
  processingTime: number;
  uploadId: string;
  originalVideoName: string;
  authMethod?: string;
}

export interface HealthResponse {
  healthy: boolean;
  services: {
    azure: boolean;
    audioExtractor: boolean;
    transcription: boolean;
    gptEnhancement: boolean;
  };
  capabilities: string[];
  auth?: {
    method: string;
    user?: string;
    authenticated: boolean;
  };
  timestamp: string;
  realCallProof?: string;
}

export class ApiResponseHandler {
  /**
   * Send success response
   */
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(res: Response, message: string, statusCode: number = 500): void {
    const response: ApiResponse = {
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    };
    
    logger.error(`API Error ${statusCode}: ${message}`);
    res.status(statusCode).json(response);
  }

  /**
   * Send upload success response
   */
  static uploadSuccess(res: Response, uploadResponse: UploadResponse): void {
    res.status(200).json(uploadResponse);
  }

  /**
   * Send transcription success response
   */
  static transcriptionSuccess(res: Response, transcriptionResponse: TranscriptionResponse): void {
    res.status(200).json(transcriptionResponse);
  }

  /**
   * Send health check response
   */
  static healthCheck(res: Response, healthResponse: HealthResponse): void {
    const statusCode = healthResponse.healthy ? 200 : 503;
    res.status(statusCode).json(healthResponse);
  }

  /**
   * Send validation error
   */
  static validationError(res: Response, message: string): void {
    this.error(res, message, 400);
  }

  /**
   * Send not found error
   */
  static notFound(res: Response, message: string = 'Resource not found'): void {
    this.error(res, message, 404);
  }

  /**
   * Send unauthorized error
   */
  static unauthorized(res: Response, message: string = 'Unauthorized - Valid authentication required'): void {
    this.error(res, message, 401);
  }

  /**
   * Handle async job response
   */
  static asyncJobStarted(res: Response, jobId: string, uploadId?: string): void {
    const response = {
      jobId,
      uploadId,
      status: 'started',
      message: 'Transcription job started. Results will be sent to callback URL if provided.'
    };
    
    res.status(200).json(response);
  }

  /**
   * Generic error handler for Express middleware
   */
  static handleError(error: any, res: Response, context: string = 'Unknown operation'): void {
    logger.error(`${context} error:`, error);
    
    if (error.name === 'ValidationError') {
      this.validationError(res, error.message);
    } else if (error.statusCode) {
      this.error(res, error.message, error.statusCode);
    } else {
      this.error(res, error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
