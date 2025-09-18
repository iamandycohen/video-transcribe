/**
 * Upload Manager - Handles temporary file storage and cleanup
 */

import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

export interface UploadedFile {
  id: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  expiresAt: Date;
}

export class UploadManager {
  private uploadedFiles = new Map<string, UploadedFile>();
  private cleanupIntervalId: NodeJS.Timeout;

  constructor(private expirationHours: number = 24) {
    // Clean up expired files every hour
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredFiles();
    }, 60 * 60 * 1000);
  }

  /**
   * Store an uploaded file and return its ID
   */
  public storeUploadedFile(
    originalName: string,
    filePath: string,
    mimeType: string,
    size: number
  ): string {
    const uploadId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expirationHours * 60 * 60 * 1000);

    const uploadedFile: UploadedFile = {
      id: uploadId,
      originalName,
      filePath,
      mimeType,
      size,
      uploadedAt: now,
      expiresAt: expiresAt
    };

    this.uploadedFiles.set(uploadId, uploadedFile);
    logger.info(`File stored with ID ${uploadId}: ${originalName}`);

    return uploadId;
  }

  /**
   * Get uploaded file by ID
   */
  public async getUploadedFile(uploadId: string): Promise<UploadedFile | null> {
    const uploadedFile = this.uploadedFiles.get(uploadId);
    if (!uploadedFile) {
      return null;
    }

    // Check if file still exists on disk
    try {
      await fs.access(uploadedFile.filePath);
      return uploadedFile;
    } catch {
      // File doesn't exist, remove from memory
      this.uploadedFiles.delete(uploadId);
      logger.warn(`File ${uploadId} no longer exists on disk, removed from memory`);
      return null;
    }
  }

  /**
   * Delete uploaded file from both memory and disk
   */
  public async deleteUploadedFile(uploadId: string): Promise<boolean> {
    const uploadedFile = this.uploadedFiles.get(uploadId);
    if (!uploadedFile) {
      return false;
    }

    // Remove from memory
    this.uploadedFiles.delete(uploadId);

    // Remove from disk
    try {
      await fs.unlink(uploadedFile.filePath);
      logger.info(`Deleted uploaded file: ${uploadedFile.filePath}`);
      return true;
    } catch (error) {
      logger.warn(`Failed to delete file ${uploadedFile.filePath}:`, error);
      return false;
    }
  }

  /**
   * Clean up expired files
   */
  private async cleanupExpiredFiles(): Promise<void> {
    const now = new Date();
    const expiredIds: string[] = [];

    for (const [id, file] of this.uploadedFiles.entries()) {
      if (file.expiresAt < now) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      await this.deleteUploadedFile(id);
      logger.info(`Cleaned up expired upload: ${id}`);
    }
  }

  /**
   * Get upload statistics
   */
  public getStats() {
    return {
      totalUploads: this.uploadedFiles.size,
      uploads: Array.from(this.uploadedFiles.values()).map(file => ({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        uploadedAt: file.uploadedAt,
        expiresAt: file.expiresAt
      }))
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
  }
}

// Global upload manager instance
export const uploadManager = new UploadManager();
