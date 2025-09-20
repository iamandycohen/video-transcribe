/**
 * Extract Audio Service - Atomic service for extracting audio from videos
 * Pure TypeScript service with no dependencies on other processing steps
 */

import { AudioExtractorService, AudioExtractionResult } from './audio-extractor';
import { UploadVideoService } from './upload-video-service';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';

export interface ExtractAudioRequest {
  uploadId: string;
}

export interface ExtractAudioFromPathRequest {
  filePath: string;
  originalName: string;
  uploadId: string;
}

export interface ExtractAudioResult {
  success: boolean;
  audioId: string;
  audioFilePath: string;
  originalVideoName: string;
  extractionTime: number;
  error?: string;
}

export class ExtractAudioService {
  private audioExtractor: AudioExtractorService;
  private uploadService: UploadVideoService;
  private audioFiles: Map<string, { filePath: string; originalVideoName: string; createdAt: Date }> = new Map();

  constructor(uploadService?: UploadVideoService) {
    this.audioExtractor = new AudioExtractorService();
    this.uploadService = uploadService || new UploadVideoService();
  }

  /**
   * Extract audio from uploaded video - uses convention to find file by uploadId
   */
  async extractAudio(request: ExtractAudioRequest): Promise<ExtractAudioResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting audio extraction for uploadId: ${request.uploadId}`);

      // Use convention: video files are stored as {uploadId}.mp4
      const videoFilePath = path.join('./temp/uploads', `${request.uploadId}.mp4`);
      
      // Check if file exists
      try {
        await fs.access(videoFilePath);
      } catch {
        throw new Error('Video file not found for uploadId');
      }

      // Validate video file
      const isValid = await this.audioExtractor.validateMp4File(videoFilePath);
      if (!isValid) {
        throw new Error('Invalid MP4 file');
      }

      // Extract audio
      const audioResult: AudioExtractionResult = await this.audioExtractor.extractAudioFromMp4(videoFilePath);

      // Generate audioId using convention: audio_{uploadId}_{timestamp}
      const audioId = `audio_${request.uploadId}_${Date.now()}`;
      this.audioFiles.set(audioId, {
        filePath: audioResult.audioFilePath,
        originalVideoName: `video_${request.uploadId}.mp4`,
        createdAt: new Date()
      });

      const extractionTime = Date.now() - startTime;

      logger.info(`Audio extraction completed for uploadId: ${request.uploadId} → audioId: ${audioId} in ${extractionTime}ms`);

      return {
        success: true,
        audioId,
        audioFilePath: audioResult.audioFilePath,
        originalVideoName: `video_${request.uploadId}.mp4`,
        extractionTime
      };

    } catch (error) {
      const extractionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Audio extraction failed for uploadId: ${request.uploadId}:`, error);

      return {
        success: false,
        audioId: '',
        audioFilePath: '',
        originalVideoName: '',
        extractionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Extract audio from direct file path - bypasses upload lookup
   */
  async extractAudioFromPath(request: ExtractAudioFromPathRequest): Promise<ExtractAudioResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting audio extraction from path: ${request.filePath}`);

      // Validate video file
      const isValid = await this.audioExtractor.validateMp4File(request.filePath);
      if (!isValid) {
        throw new Error('Invalid MP4 file');
      }

      // Extract audio
      const audioResult: AudioExtractionResult = await this.audioExtractor.extractAudioFromMp4(request.filePath);

      // Generate audioId and store reference
      const audioId = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      this.audioFiles.set(audioId, {
        filePath: audioResult.audioFilePath,
        originalVideoName: request.originalName,
        createdAt: new Date()
      });

      const extractionTime = Date.now() - startTime;

      logger.info(`Audio extraction completed from path → audioId: ${audioId} in ${extractionTime}ms`);

      return {
        success: true,
        audioId,
        audioFilePath: audioResult.audioFilePath,
        originalVideoName: request.originalName,
        extractionTime
      };

    } catch (error) {
      const extractionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Audio extraction failed from path: ${request.filePath}:`, error);

      return {
        success: false,
        audioId: '',
        audioFilePath: '',
        originalVideoName: '',
        extractionTime,
        error: errorMessage
      };
    }
  }

  /**
   * Get audio file path by audioId
   */
  async getAudioFile(audioId: string): Promise<{ filePath: string; originalVideoName: string } | null> {
    const audioFile = this.audioFiles.get(audioId);
    if (!audioFile) {
      return null;
    }

    // Check if file still exists
    try {
      const fs = await import('fs');
      await fs.promises.access(audioFile.filePath);
      return {
        filePath: audioFile.filePath,
        originalVideoName: audioFile.originalVideoName
      };
    } catch {
      // File doesn't exist, remove from map
      this.audioFiles.delete(audioId);
      return null;
    }
  }

  /**
   * Clean up audio file
   */
  async cleanupAudio(audioId: string): Promise<boolean> {
    try {
      const audioFile = this.audioFiles.get(audioId);
      if (audioFile) {
        await this.audioExtractor.cleanup(audioFile.filePath);
        this.audioFiles.delete(audioId);
        logger.info(`Cleaned up audio file: ${audioId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to cleanup audio file ${audioId}:`, error);
      return false;
    }
  }

  /**
   * Get service stats
   */
  getStats(): {
    activeAudioFiles: number;
    totalExtracted: number;
  } {
    return {
      activeAudioFiles: this.audioFiles.size,
      totalExtracted: this.audioFiles.size
    };
  }
}
