/**
 * Transcribe Audio Service - Atomic service for transcribing audio to text
 * Pure TypeScript service with no dependencies on other processing steps
 */

import { TranscriptionService, TranscriptionResult } from './transcription-service';
import { logger } from '../utils/logger';

export interface TranscribeAudioRequest {
  audioId: string;
  audioFilePath: string;
}

export interface TranscribeAudioResult {
  success: boolean;
  transcriptionId: string;
  rawText: string;
  segments: Array<{
    text: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
  language: string;
  confidence: number;
  duration: number;
  transcriptionTime: number;
  error?: string;
}

export class TranscribeAudioService {
  private transcriptionService: TranscriptionService;
  private transcriptions: Map<string, TranscriptionResult> = new Map();

  constructor() {
    this.transcriptionService = new TranscriptionService();
  }

  /**
   * Transcribe audio file to text - returns transcriptionId and raw text
   */
  async transcribeAudio(request: TranscribeAudioRequest): Promise<TranscribeAudioResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting transcription for audioId: ${request.audioId}`);

      // Verify audio file exists
      const fs = await import('fs');
      await fs.promises.access(request.audioFilePath);

      // Transcribe audio
      const transcriptionResult: TranscriptionResult = await this.transcriptionService.transcribeAudioFile(request.audioFilePath);

      // Generate transcriptionId and store result
      const transcriptionId = `transcription_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.transcriptions.set(transcriptionId, transcriptionResult);

      const transcriptionTime = Date.now() - startTime;

      logger.info(`Transcription completed for audioId: ${request.audioId} → transcriptionId: ${transcriptionId} in ${transcriptionTime}ms`);

      return {
        success: true,
        transcriptionId,
        rawText: transcriptionResult.fullText,
        segments: transcriptionResult.segments,
        language: transcriptionResult.language,
        confidence: transcriptionResult.confidence,
        duration: transcriptionResult.duration,
        transcriptionTime
      };

    } catch (error) {
      const transcriptionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Transcription failed for audioId: ${request.audioId}:`, error);

      return {
        success: false,
        transcriptionId: '',
        rawText: '',
        segments: [],
        language: 'en-US',
        confidence: 0,
        duration: 0,
        transcriptionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Get transcription result by transcriptionId
   */
  async getTranscription(transcriptionId: string): Promise<TranscriptionResult | null> {
    return this.transcriptions.get(transcriptionId) || null;
  }

  /**
   * Get raw text from transcriptionId
   */
  async getRawText(transcriptionId: string): Promise<string | null> {
    const transcription = this.transcriptions.get(transcriptionId);
    return transcription ? transcription.fullText : null;
  }

  /**
   * Get service stats
   */
  getStats(): {
    activeTranscriptions: number;
    totalTranscribed: number;
  } {
    return {
      activeTranscriptions: this.transcriptions.size,
      totalTranscribed: this.transcriptions.size
    };
  }
}
