/**
 * Upload Video Service - Pure TypeScript service for handling video uploads
 * No dependencies on Express or HTTP - can be used by API, CLI, MCP server, etc.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface UploadedVideo {
  uploadId: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  expiresAt: Date;
}

export interface UploadVideoOptions {
  tempDir?: string;
  expirationHours?: number;
}

export interface UploadVideoResult {
  uploadId: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  expiresAt: string;
  message: string;
}

export class UploadVideoService {
  private uploads: Map<string, UploadedVideo> = new Map();
  private tempDir: string;
  private defaultExpirationHours: number;

  constructor(options: UploadVideoOptions = {}) {
    this.tempDir = options.tempDir || './temp/uploads';
    this.defaultExpirationHours = options.expirationHours || 24;
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

  /**
   * Store an uploaded video file and return upload metadata
   */
  async storeVideo(
    file: { 
      originalname: string; 
      path: string; 
      mimetype: string; 
      size: number; 
    }
  ): Promise<UploadVideoResult> {
    try {
      const uploadId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.defaultExpirationHours * 60 * 60 * 1000);

      // Validate file type
      if (file.mimetype !== 'video/mp4') {
        throw new Error('Only MP4 files are supported');
      }

      // Store upload metadata
      const uploadedVideo: UploadedVideo = {
        uploadId,
        originalName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: now,
        expiresAt
      };

      this.uploads.set(uploadId, uploadedVideo);

      logger.info(`Video stored successfully: ${uploadId} (${file.originalname})`);

      return {
        uploadId,
        originalName: file.originalname,
        size: file.size,
        uploadedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        message: 'Video uploaded successfully. Use the uploadId to process the video.'
      };

    } catch (error) {
      logger.error('Failed to store video:', error);
      throw error;
    }
  }

  /**
   * Store a video file from a file path (for CLI, direct usage)
   */
  async storeVideoFromPath(filePath: string): Promise<UploadVideoResult> {
    try {
      // Get file stats
      const stats = await fs.stat(filePath);
      const originalName = path.basename(filePath);
      
      // Copy file to temp directory using convention: {uploadId}.mp4
      const uploadId = uuidv4();
      const targetPath = path.join(this.tempDir, `${uploadId}.mp4`);
      await fs.copyFile(filePath, targetPath);

      const file = {
        originalname: originalName,
        path: targetPath,
        mimetype: 'video/mp4', // Assume MP4 for now, could add validation
        size: stats.size
      };

      return await this.storeVideo(file);

    } catch (error) {
      logger.error('Failed to store video from path:', error);
      throw error;
    }
  }

  /**
   * Store a video file from a remote URL (for API usage)
   */
  async storeVideoFromUrl(url: string): Promise<UploadVideoResult> {
    try {
      logger.info(`Downloading video from URL: ${url}`);
      
      // Download the video
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
      }
      
      // Get filename from URL or use default
      const urlPath = new URL(url).pathname;
      const originalName = path.basename(urlPath) || 'video.mp4';
      
      // Create uploadId first and use it consistently
      const uploadId = uuidv4();
      const targetPath = path.join(this.tempDir, `${uploadId}.mp4`);
      
      // Write downloaded content to file
      const arrayBuffer = await response.arrayBuffer();
      await fs.writeFile(targetPath, Buffer.from(arrayBuffer));
      
      logger.info(`Video downloaded successfully: ${arrayBuffer.byteLength} bytes`);
      
      // Store metadata directly (don't call storeVideo which creates a new uploadId)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.defaultExpirationHours * 60 * 60 * 1000);

      const uploadedVideo: UploadedVideo = {
        uploadId,
        originalName,
        filePath: targetPath,
        mimeType: 'video/mp4',
        size: arrayBuffer.byteLength,
        uploadedAt: now,
        expiresAt
      };

      this.uploads.set(uploadId, uploadedVideo);
      logger.info(`Video stored successfully: ${uploadId} (${originalName})`);

      return {
        uploadId,
        originalName,
        size: arrayBuffer.byteLength,
        uploadedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        message: 'Video uploaded successfully. Use the uploadId to process the video.'
      };

    } catch (error) {
      logger.error('Failed to store video from URL:', error);
      throw error;
    }
  }

  /**
   * Retrieve uploaded video metadata
   */
  async getUploadedVideo(uploadId: string): Promise<UploadedVideo | null> {
    const upload = this.uploads.get(uploadId);
    
    if (!upload) {
      return null;
    }

    // Check if expired
    if (new Date() > upload.expiresAt) {
      await this.deleteUploadedVideo(uploadId);
      return null;
    }

    return upload;
  }

  /**
   * Delete uploaded video and clean up files
   */
  async deleteUploadedVideo(uploadId: string): Promise<boolean> {
    try {
      const upload = this.uploads.get(uploadId);
      
      if (upload) {
        // Delete physical file
        try {
          await fs.unlink(upload.filePath);
        } catch (fileError) {
          logger.warn(`Could not delete file for upload ${uploadId}:`, fileError);
        }

        // Remove from memory
        this.uploads.delete(uploadId);
        logger.info(`Deleted uploaded video: ${uploadId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to delete uploaded video ${uploadId}:`, error);
      return false;
    }
  }

  /**
   * Clean up expired uploads
   */
  async cleanupExpiredUploads(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [uploadId, upload] of this.uploads.entries()) {
      if (now > upload.expiresAt) {
        await this.deleteUploadedVideo(uploadId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired uploads`);
    }

    return cleaned;
  }

  /**
   * Get upload statistics
   */
  getStats(): {
    totalUploads: number;
    activeUploads: number;
    totalSize: number;
  } {
    let totalSize = 0;
    for (const upload of this.uploads.values()) {
      totalSize += upload.size;
    }

    return {
      totalUploads: this.uploads.size,
      activeUploads: this.uploads.size,
      totalSize
    };
  }
}
