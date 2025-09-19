import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { azureConfig } from '../config/azure-config';
import { logger } from '../utils/logger';
import { ProgressCallback } from '../types/progress';

// Import ffprobe-static with proper typing
const ffprobeStatic = require('ffprobe-static') as { path: string };

// Set ffmpeg and ffprobe paths
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic?.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

export interface AudioExtractionResult {
  audioFilePath: string;
  duration: number;
  format: string;
}

// Remove old interface - now using unified ProgressCallback

export class AudioExtractorService {
  private tempDir: string;

  constructor() {
    this.tempDir = azureConfig.app.tempDir;
    this.ensureTempDirectory();
  }

  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory:', error);
      throw error;
    }
  }

  public async extractAudioFromMp4(
    mp4FilePath: string, 
    onProgress?: ProgressCallback
  ): Promise<AudioExtractionResult> {
    const startTime = Date.now();
    const audioFileName = `${uuidv4()}.wav`;
    const audioFilePath = path.join(this.tempDir, audioFileName);

    logger.info(`Starting audio extraction from: ${mp4FilePath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(mp4FilePath)
        .audioCodec('pcm_s16le')
        .audioChannels(1) // Mono for better transcription
        .audioFrequency(16000) // 16kHz for speech recognition
        .format('wav')
        .on('start', (commandLine) => {
          logger.debug(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            const percent = Math.round(progress.percent);
            logger.debug(`Audio extraction progress: ${percent}%`);
            
            // Report progress to callback if provided
            if (onProgress) {
              onProgress({
                type: 'extraction',
                progress: percent,
                message: `🔧 Extracting audio: ${percent}%`,
                timestamp: Date.now()
              });
            }
          }
        })
        .on('end', () => {
          const duration = Date.now() - startTime;
          logger.info(`Audio extraction completed in ${duration}ms: ${audioFilePath}`);
          
          // Get audio duration
          ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
            if (err) {
              logger.error('Failed to get audio metadata:', err);
              reject(err);
              return;
            }

            const audioDuration = metadata.format.duration || 0;
            resolve({
              audioFilePath,
              duration: audioDuration,
              format: 'wav'
            });
          });
        })
        .on('error', (error) => {
          logger.error('Audio extraction failed:', error);
          reject(error);
        })
        .save(audioFilePath);
    });
  }

  public async cleanup(audioFilePath: string): Promise<void> {
    try {
      await fs.unlink(audioFilePath);
      logger.info(`Cleaned up temporary file: ${audioFilePath}`);
    } catch (error) {
      logger.warn(`Failed to cleanup file ${audioFilePath}:`, error);
    }
  }

  public async validateMp4File(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      
      return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            logger.error('Invalid MP4 file:', err);
            resolve(false);
            return;
          }

          const hasVideo = metadata.streams.some(stream => stream.codec_type === 'video');
          const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
          
          if (!hasAudio) {
            logger.warn('MP4 file has no audio track');
          }

          resolve(hasVideo && hasAudio);
        });
      });
    } catch (error) {
      logger.error('File access error:', error);
      return false;
    }
  }
}

