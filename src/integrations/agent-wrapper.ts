/**
 * TranscriptionAgentWrapper - DEPRECATED
 * 
 * This wrapper is deprecated. Use atomic services directly instead:
 * - UploadVideoService
 * - ExtractAudioService  
 * - TranscribeAudioService
 * - EnhanceTranscriptionService
 * - SummarizeContentService
 * - etc.
 * 
 * Or use the atomic API endpoints directly.
 */

import { logger } from '../utils/logger';

export class TranscriptionAgentWrapper {
  constructor() {
    logger.warn('TranscriptionAgentWrapper is DEPRECATED');
    logger.info('Use atomic services directly:');
    logger.info('- UploadVideoService.storeVideo()');
    logger.info('- ExtractAudioService.extractAudio()');
    logger.info('- TranscribeAudioService.transcribeAudio()');
    logger.info('- EnhanceTranscriptionService.enhanceTranscription()');
    logger.info('- SummarizeContentService.summarizeContent()');
    logger.info('Or use atomic API endpoints: POST /upload, /extract-audio, /transcribe-audio, etc.');
  }

  /**
   * @deprecated Use atomic services directly
   */
  public async transcribeVideo(args: {
    videoPath: string;
    enhance?: boolean;
    outputFormat?: 'json' | 'txt' | 'both';
  }): Promise<{
    success: boolean;
    transcription?: string;
    summary?: string;
    keyPoints?: string[];
    topics?: string[];
    sentiment?: string;
    outputFiles?: string[];
    processingTime?: number;
    error?: string;
  }> {
    const errorMessage = `
TranscriptionAgentWrapper.transcribeVideo() is DEPRECATED.

Use atomic services instead:
1. UploadVideoService.storeVideoFromPath(videoPath) → uploadId
2. ExtractAudioService.extractAudio(uploadId) → audioId  
3. TranscribeAudioService.transcribeAudio(audioId) → rawText
4. EnhanceTranscriptionService.enhanceTranscription(rawText) → enhancedText
5. SummarizeContentService.summarizeContent(enhancedText) → summary

This allows for better agent composition and flexibility.
`;

    logger.error(errorMessage);
    return {
      success: false,
      error: 'TranscriptionAgentWrapper is deprecated. Use atomic services instead.'
    };
  }

  /**
   * @deprecated Use atomic services directly
   */
  public getToolDescription() {
    return {
      name: 'transcribe_video_DEPRECATED',
      description: 'DEPRECATED: Use atomic services instead',
      parameters: {
        type: 'object',
        properties: {
          note: {
            type: 'string',
            description: 'This tool is deprecated. Use atomic services: UploadVideoService, ExtractAudioService, TranscribeAudioService, etc.'
          }
        }
      }
    };
  }

  /**
   * @deprecated Use HealthCheckService directly
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
    capabilities: string[];
  }> {
    logger.warn('TranscriptionAgentWrapper.healthCheck() is deprecated. Use HealthCheckService instead.');
    return {
      healthy: false,
      services: {},
      capabilities: ['Use HealthCheckService.checkHealth() instead']
    };
  }
}