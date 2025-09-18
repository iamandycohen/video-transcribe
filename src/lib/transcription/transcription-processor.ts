/**
 * Transcription Processor - Core transcription logic optimized for API usage
 * Separated from file-based operations for cleaner API integration
 */

import { AudioExtractorService, AudioExtractionResult } from '../../services/audio-extractor';
import { TranscriptionService, TranscriptionResult } from '../../services/transcription-service';
import { GPTEnhancementService, EnhancedTranscription } from '../../services/gpt-enhancement-service';
import { validateConfig } from '../../config/azure-config';
import { logger } from '../../utils/logger';

export interface ProcessingOptions {
  videoPath: string;
  enhance?: boolean;
  keepAudioFile?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  transcription: string;
  rawTranscription?: TranscriptionResult;
  enhancement?: EnhancedTranscription;
  processingTime: number;
  error?: string;
  
  // Structured data for API responses
  summary?: string;
  keyPoints?: string[];
  topics?: string[];
  sentiment?: string;
}

export class TranscriptionProcessor {
  private audioExtractor: AudioExtractorService;
  private transcriptionService: TranscriptionService;
  private gptEnhancementService: GPTEnhancementService;

  constructor() {
    // Validate configuration on startup
    validateConfig();
    
    this.audioExtractor = new AudioExtractorService();
    this.transcriptionService = new TranscriptionService();
    this.gptEnhancementService = new GPTEnhancementService();
  }

  /**
   * Process video and return structured result (no file saving)
   */
  public async processVideo(options: ProcessingOptions): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    logger.info(`Starting transcription processing for: ${options.videoPath}`);

    try {
      // Step 1: Validate input file
      await this.validateInputFile(options.videoPath);

      // Step 2: Extract audio
      const audioResult = await this.extractAudio(options.videoPath);
      
      // Step 3: Transcribe audio
      const transcriptionResult = await this.transcribeAudio(audioResult.audioFilePath);
      
      // Step 4: Enhance with GPT (optional)
      let enhancement: EnhancedTranscription | undefined;
      if (options.enhance) {
        try {
          enhancement = await this.enhanceTranscription(transcriptionResult);
        } catch (error) {
          logger.error('GPT enhancement failed:', error);
          logger.warn('Continuing without GPT enhancement...');
          enhancement = undefined;
        }
      }

      // Step 5: Cleanup audio file
      if (!options.keepAudioFile) {
        await this.audioExtractor.cleanup(audioResult.audioFilePath);
      }

      const processingTime = Date.now() - startTime;
      
      // Return structured result
      const result: ProcessingResult = {
        success: true,
        transcription: enhancement?.enhancedText || transcriptionResult.fullText,
        rawTranscription: transcriptionResult,
        enhancement,
        processingTime,
        
        // Structured API data
        summary: enhancement?.summary,
        keyPoints: enhancement?.keyPoints,
        topics: enhancement?.topics,
        sentiment: enhancement?.sentiment
      };

      logger.info(`Transcription processing completed successfully in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Transcription processing failed:`, error);
      
      return {
        success: false,
        transcription: '',
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Get service health status
   */
  public async getStatus(): Promise<{ 
    healthy: boolean; 
    services: Record<string, boolean>;
    capabilities: string[];
  }> {
    try {
      // Test Azure connection
      const azureHealthy = await this.transcriptionService['azureClient'].testConnection();
      
      return {
        healthy: azureHealthy,
        services: {
          azure: azureHealthy,
          audioExtractor: true,
          transcription: azureHealthy,
          gptEnhancement: azureHealthy
        },
        capabilities: [
          'video_transcription',
          'audio_extraction', 
          'speech_to_text',
          'gpt_enhancement',
          'summary_generation',
          'topic_extraction',
          'sentiment_analysis'
        ]
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        healthy: false,
        services: {
          azure: false,
          audioExtractor: false,
          transcription: false,
          gptEnhancement: false
        },
        capabilities: []
      };
    }
  }

  private async validateInputFile(filePath: string): Promise<void> {
    const isValid = await this.audioExtractor.validateMp4File(filePath);
    if (!isValid) {
      throw new Error(`Invalid or inaccessible MP4 file: ${filePath}`);
    }
  }

  private async extractAudio(mp4FilePath: string): Promise<AudioExtractionResult> {
    logger.info('Extracting audio from MP4...');
    return await this.audioExtractor.extractAudioFromMp4(mp4FilePath);
  }

  private async transcribeAudio(audioFilePath: string): Promise<TranscriptionResult> {
    logger.info('Transcribing audio...');
    return await this.transcriptionService.transcribeAudioFile(audioFilePath);
  }

  private async enhanceTranscription(transcription: TranscriptionResult): Promise<EnhancedTranscription> {
    logger.info('Enhancing transcription with GPT...');
    return await this.gptEnhancementService.enhanceTranscription(transcription);
  }
}
