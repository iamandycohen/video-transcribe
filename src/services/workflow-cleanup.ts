/**
 * Workflow Cleanup Service - Simple cascade cleanup based on workflow progression
 * - After audio extraction: delete video file
 * - After transcription: delete audio file
 */

import { ServiceManager } from './service-manager';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';

export interface CleanupResult {
  success: boolean;
  fileDeleted?: string;
  spaceFreed?: number;
  error?: string;
}

export class WorkflowCleanupService {
  constructor(private tempDir: string = './temp') {}

  /**
   * Clean up video file after audio extraction is complete
   * Call this after successfully extracting audio from video
   */
  async cleanupVideoAfterAudioExtraction(uploadId: string): Promise<CleanupResult> {
    try {
      logger.info(`Cleaning up video file after audio extraction for uploadId: ${uploadId}`);

      const serviceManager = ServiceManager.getInstance();
      const uploadService = serviceManager.getUploadVideoService();
      
      // Get file info before deletion
      const upload = await uploadService.getUploadedVideo(uploadId);
      if (!upload) {
        return {
          success: false,
          error: `Upload ${uploadId} not found`
        };
      }

      const spaceFreed = upload.size;
      const fileName = path.basename(upload.filePath);

      // Delete the video file
      const deleted = await uploadService.deleteUploadedVideo(uploadId);
      
      if (deleted) {
        logger.info(`Video file deleted after audio extraction: ${fileName} (${spaceFreed} bytes freed)`);
        return {
          success: true,
          fileDeleted: fileName,
          spaceFreed
        };
      } else {
        return {
          success: false,
          error: `Failed to delete video file for uploadId: ${uploadId}`
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to cleanup video after audio extraction for ${uploadId}:`, error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Clean up audio file after transcription is complete
   * Call this after successfully transcribing audio to text
   */
  async cleanupAudioAfterTranscription(audioId: string): Promise<CleanupResult> {
    try {
      logger.info(`Cleaning up audio file after transcription for audioId: ${audioId}`);

      const serviceManager = ServiceManager.getInstance();
      const extractAudioService = serviceManager.getExtractAudioService();
      
      // Get audio file info before deletion
      const audioFile = await extractAudioService.getAudioFile(audioId);
      if (!audioFile) {
        return {
          success: false,
          error: `Audio file ${audioId} not found`
        };
      }

      // Get file size before deletion
      let spaceFreed = 0;
      try {
        const stats = await fs.stat(audioFile.filePath);
        spaceFreed = stats.size;
      } catch (error) {
        // File might not exist, that's okay
      }

      const fileName = path.basename(audioFile.filePath);

      // Delete the audio file
      const deleted = await extractAudioService.cleanupAudio(audioId);
      
      if (deleted) {
        logger.info(`Audio file deleted after transcription: ${fileName} (${spaceFreed} bytes freed)`);
        return {
          success: true,
          fileDeleted: fileName,
          spaceFreed
        };
      } else {
        return {
          success: false,
          error: `Failed to delete audio file for audioId: ${audioId}`
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to cleanup audio after transcription for ${audioId}:`, error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Clean up both video and audio for a complete workflow
   * Call this when you want to clean up everything for an upload
   */
  async cleanupCompleteWorkflow(uploadId: string, audioId?: string): Promise<{
    videoCleanup: CleanupResult;
    audioCleanup?: CleanupResult;
  }> {
    logger.info(`Cleaning up complete workflow for uploadId: ${uploadId}`);

    const result: {
      videoCleanup: CleanupResult;
      audioCleanup?: CleanupResult;
    } = {
      videoCleanup: await this.cleanupVideoAfterAudioExtraction(uploadId)
    };

    if (audioId) {
      result.audioCleanup = await this.cleanupAudioAfterTranscription(audioId);
    }

    const totalSpaceFreed = (result.videoCleanup.spaceFreed || 0) + (result.audioCleanup?.spaceFreed || 0);
    logger.info(`Complete workflow cleanup for ${uploadId}: ${totalSpaceFreed} bytes freed`);

    return result;
  }

  /**
   * Get workflow cleanup stats
   */
  async getWorkflowStats(): Promise<{
    activeVideos: number;
    activeAudioFiles: number;
    totalVideoSize: number;
    totalAudioSize: number;
  }> {
    const serviceManager = ServiceManager.getInstance();
    const uploadService = serviceManager.getUploadVideoService();
    const uploadStats = uploadService.getStats();

    // Count audio files
    let activeAudioFiles = 0;
    let totalAudioSize = 0;

    try {
      const files = await fs.readdir(this.tempDir);
      const audioFiles = files.filter(file => file.endsWith('.wav') || file.endsWith('.mp3'));
      
      activeAudioFiles = audioFiles.length;
      
      for (const file of audioFiles) {
        try {
          const filePath = path.join(this.tempDir, file);
          const stats = await fs.stat(filePath);
          totalAudioSize += stats.size;
        } catch (error) {
          // File might have been deleted, ignore
        }
      }
    } catch (error) {
      logger.error('Failed to get audio file stats:', error);
    }

    return {
      activeVideos: uploadStats.activeUploads,
      activeAudioFiles,
      totalVideoSize: uploadStats.totalSize,
      totalAudioSize
    };
  }
}
