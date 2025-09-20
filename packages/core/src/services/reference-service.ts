/**
 * Reference Service - Manages file references using temp folder URLs
 * Enables pass-by-reference instead of pass-by-value for large files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface FileReference {
  url: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  created_at: string;
}

export class ReferenceService {
  private tempDir: string;
  private baseUrl: string;

  constructor(tempDir: string = './temp', baseUrl: string = 'file://') {
    this.tempDir = tempDir;
    this.baseUrl = baseUrl;
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
   * Store a video file and return a reference URL
   */
  async storeVideo(buffer: Buffer, originalName: string, workflow_id: string): Promise<string> {
    try {
      const fileId = uuidv4();
      const extension = path.extname(originalName) || '.mp4';
      const fileName = `video_${workflow_id}_${fileId}${extension}`;
      const filePath = path.join(this.tempDir, fileName);
      
      await fs.writeFile(filePath, buffer);
      
      const url = `${this.baseUrl}${fileName}`;
      logger.info(`Stored video reference: ${url} (${buffer.length} bytes)`);
      
      return url;
    } catch (error) {
      logger.error('Failed to store video reference:', error);
      throw error;
    }
  }

  /**
   * Store an audio file and return a reference URL
   */
  async storeAudio(buffer: Buffer, workflow_id: string): Promise<string> {
    try {
      const fileId = uuidv4();
      const fileName = `audio_${workflow_id}_${fileId}.wav`;
      const filePath = path.join(this.tempDir, fileName);
      
      await fs.writeFile(filePath, buffer);
      
      const url = `${this.baseUrl}${fileName}`;
      logger.info(`Stored audio reference: ${url} (${buffer.length} bytes)`);
      
      return url;
    } catch (error) {
      logger.error('Failed to store audio reference:', error);
      throw error;
    }
  }

  /**
   * Get file path from reference URL
   */
  getFilePathFromUrl(url: string): string {
    const fileName = url.replace(this.baseUrl, '');
    return path.join(this.tempDir, fileName);
  }

  /**
   * Get file buffer from reference URL
   */
  async getFileBuffer(url: string): Promise<Buffer> {
    try {
      const filePath = this.getFilePathFromUrl(url);
      return await fs.readFile(filePath);
    } catch (error) {
      logger.error(`Failed to get file buffer for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get file stream from reference URL
   */
  async getFileStream(url: string): Promise<{ stream: Buffer, stats: any }> {
    try {
      const filePath = this.getFilePathFromUrl(url);
      const stats = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);
      
      return { stream: buffer, stats };
    } catch (error) {
      logger.error(`Failed to get file stream for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists for reference URL
   */
  async exists(url: string): Promise<boolean> {
    try {
      const filePath = this.getFilePathFromUrl(url);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file info from reference URL
   */
  async getFileInfo(url: string): Promise<FileReference | null> {
    try {
      const filePath = this.getFilePathFromUrl(url);
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      return {
        url,
        filePath,
        originalName: fileName,
        mimeType: this.getMimeType(fileName),
        size: stats.size,
        created_at: stats.birthtime.toISOString()
      };
    } catch (error) {
      logger.warn(`Failed to get file info for ${url}:`, error);
      return null;
    }
  }

  /**
   * Delete file by reference URL
   */
  async cleanup(url: string): Promise<{ success: boolean; spaceFreed: number }> {
    try {
      const filePath = this.getFilePathFromUrl(url);
      const stats = await fs.stat(filePath);
      const spaceFreed = stats.size;
      
      await fs.unlink(filePath);
      
      logger.info(`Cleaned up file reference: ${url} (${spaceFreed} bytes freed)`);
      return { success: true, spaceFreed };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        logger.warn(`File not found for cleanup: ${url}`);
        return { success: false, spaceFreed: 0 };
      }
      logger.error(`Failed to cleanup file ${url}:`, error);
      throw error;
    }
  }

  /**
   * Store local file as reference (copy to temp directory)
   */
  async storeFromPath(filePath: string, workflow_id: string): Promise<string> {
    try {
      logger.info(`Storing local file: ${filePath}`);
      
      // Read the local file
      const buffer = await fs.readFile(filePath);
      const originalName = path.basename(filePath);
      
      return await this.storeVideo(buffer, originalName, workflow_id);
    } catch (error) {
      logger.error(`Failed to store from path ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Download file from remote URL and store as reference
   */
  async storeFromUrl(sourceUrl: string, workflow_id: string): Promise<string> {
    try {
      logger.info(`Downloading file from URL: ${sourceUrl}`);
      
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const originalName = this.getFileNameFromUrl(sourceUrl);
      
      return await this.storeVideo(buffer, originalName, workflow_id);
    } catch (error) {
      logger.error(`Failed to store from URL ${sourceUrl}:`, error);
      throw error;
    }
  }

  /**
   * Download file from remote URL with progress reporting
   */
  async storeFromUrlWithProgress(
    sourceUrl: string, 
    workflow_id: string,
    onProgress?: (downloaded: number, total: number, percentage: number) => void,
    cancellationToken?: AbortSignal
  ): Promise<string> {
    try {
      logger.info(`Downloading file from URL: ${sourceUrl}`);
      
      const response = await fetch(sourceUrl, { signal: cancellationToken });
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
      }
      
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const originalName = this.getFileNameFromUrl(sourceUrl);
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Stream the download with progress tracking
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let downloaded = 0;
      
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Check for cancellation
        if (cancellationToken?.aborted) {
          reader.cancel();
          throw new Error('Download cancelled by user');
        }
        
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        downloaded += value.length;
        
        if (onProgress && contentLength > 0) {
          const percentage = Math.round((downloaded / contentLength) * 100);
          onProgress(downloaded, contentLength, percentage);
        }
      }
      
      // Combine all chunks
      const buffer = Buffer.concat(chunks);
      
      return await this.storeVideo(buffer, originalName, workflow_id);
    } catch (error) {
      logger.error(`Failed to store from URL ${sourceUrl}:`, error);
      throw error;
    }
  }

  /**
   * Clean up all files for a workflow
   */
  async cleanupWorkflow(workflow_id: string): Promise<{ filesDeleted: number; spaceFreed: number }> {
    try {
      const files = await fs.readdir(this.tempDir);
      const workflowFiles = files.filter(file => file.includes(workflow_id));
      
      let filesDeleted = 0;
      let spaceFreed = 0;
      
      for (const file of workflowFiles) {
        try {
          const filePath = path.join(this.tempDir, file);
          const stats = await fs.stat(filePath);
          await fs.unlink(filePath);
          
          filesDeleted++;
          spaceFreed += stats.size;
        } catch (error) {
          logger.warn(`Failed to delete workflow file ${file}:`, error);
        }
      }
      
      if (filesDeleted > 0) {
        logger.info(`Cleaned up ${filesDeleted} files for workflow ${workflow_id} (${spaceFreed} bytes freed)`);
      }
      
      return { filesDeleted, spaceFreed };
    } catch (error) {
      logger.error(`Failed to cleanup workflow ${workflow_id}:`, error);
      return { filesDeleted: 0, spaceFreed: 0 };
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.mp4': return 'video/mp4';
      case '.wav': return 'audio/wav';
      case '.mp3': return 'audio/mp3';
      case '.txt': return 'text/plain';
      case '.json': return 'application/json';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Extract filename from URL
   */
  private getFileNameFromUrl(url: string): string {
    try {
      const urlPath = new URL(url).pathname;
      return path.basename(urlPath) || 'video.mp4';
    } catch {
      return 'video.mp4';
    }
  }

  /**
   * Get reference service statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    videoFiles: number;
    audioFiles: number;
  }> {
    try {
      const files = await fs.readdir(this.tempDir);
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        videoFiles: 0,
        audioFiles: 0
      };

      for (const file of files) {
        try {
          const filePath = path.join(this.tempDir, file);
          const fileStats = await fs.stat(filePath);
          
          if (fileStats.isFile()) {
            stats.totalFiles++;
            stats.totalSize += fileStats.size;
            
            if (file.startsWith('video_')) {
              stats.videoFiles++;
            } else if (file.startsWith('audio_')) {
              stats.audioFiles++;
            }
          }
        } catch {
          // File might have been deleted, skip
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get reference service stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        videoFiles: 0,
        audioFiles: 0
      };
    }
  }
}
