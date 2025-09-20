"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class ReferenceService {
    tempDir;
    baseUrl;
    constructor(tempDir = './temp', baseUrl = 'file://') {
        this.tempDir = tempDir;
        this.baseUrl = baseUrl;
        this.ensureTempDirectory();
    }
    async ensureTempDirectory() {
        try {
            await fs_1.promises.mkdir(this.tempDir, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Failed to create temp directory:', error);
            throw error;
        }
    }
    async storeVideo(buffer, originalName, workflow_id) {
        try {
            const fileId = (0, uuid_1.v4)();
            const extension = path_1.default.extname(originalName) || '.mp4';
            const fileName = `video_${workflow_id}_${fileId}${extension}`;
            const filePath = path_1.default.join(this.tempDir, fileName);
            await fs_1.promises.writeFile(filePath, buffer);
            const url = `${this.baseUrl}${fileName}`;
            logger_1.logger.info(`Stored video reference: ${url} (${buffer.length} bytes)`);
            return url;
        }
        catch (error) {
            logger_1.logger.error('Failed to store video reference:', error);
            throw error;
        }
    }
    async storeAudio(buffer, workflow_id) {
        try {
            const fileId = (0, uuid_1.v4)();
            const fileName = `audio_${workflow_id}_${fileId}.wav`;
            const filePath = path_1.default.join(this.tempDir, fileName);
            await fs_1.promises.writeFile(filePath, buffer);
            const url = `${this.baseUrl}${fileName}`;
            logger_1.logger.info(`Stored audio reference: ${url} (${buffer.length} bytes)`);
            return url;
        }
        catch (error) {
            logger_1.logger.error('Failed to store audio reference:', error);
            throw error;
        }
    }
    getFilePathFromUrl(url) {
        const fileName = url.replace(this.baseUrl, '');
        return path_1.default.join(this.tempDir, fileName);
    }
    async getFileBuffer(url) {
        try {
            const filePath = this.getFilePathFromUrl(url);
            return await fs_1.promises.readFile(filePath);
        }
        catch (error) {
            logger_1.logger.error(`Failed to get file buffer for ${url}:`, error);
            throw error;
        }
    }
    async getFileStream(url) {
        try {
            const filePath = this.getFilePathFromUrl(url);
            const stats = await fs_1.promises.stat(filePath);
            const buffer = await fs_1.promises.readFile(filePath);
            return { stream: buffer, stats };
        }
        catch (error) {
            logger_1.logger.error(`Failed to get file stream for ${url}:`, error);
            throw error;
        }
    }
    async exists(url) {
        try {
            const filePath = this.getFilePathFromUrl(url);
            await fs_1.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getFileInfo(url) {
        try {
            const filePath = this.getFilePathFromUrl(url);
            const stats = await fs_1.promises.stat(filePath);
            const fileName = path_1.default.basename(filePath);
            return {
                url,
                filePath,
                originalName: fileName,
                mimeType: this.getMimeType(fileName),
                size: stats.size,
                created_at: stats.birthtime.toISOString()
            };
        }
        catch (error) {
            logger_1.logger.warn(`Failed to get file info for ${url}:`, error);
            return null;
        }
    }
    async cleanup(url) {
        try {
            const filePath = this.getFilePathFromUrl(url);
            const stats = await fs_1.promises.stat(filePath);
            const spaceFreed = stats.size;
            await fs_1.promises.unlink(filePath);
            logger_1.logger.info(`Cleaned up file reference: ${url} (${spaceFreed} bytes freed)`);
            return { success: true, spaceFreed };
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                logger_1.logger.warn(`File not found for cleanup: ${url}`);
                return { success: false, spaceFreed: 0 };
            }
            logger_1.logger.error(`Failed to cleanup file ${url}:`, error);
            throw error;
        }
    }
    async storeFromPath(filePath, workflow_id) {
        try {
            logger_1.logger.info(`Storing local file: ${filePath}`);
            const buffer = await fs_1.promises.readFile(filePath);
            const originalName = path_1.default.basename(filePath);
            return await this.storeVideo(buffer, originalName, workflow_id);
        }
        catch (error) {
            logger_1.logger.error(`Failed to store from path ${filePath}:`, error);
            throw error;
        }
    }
    async storeFromUrl(sourceUrl, workflow_id) {
        try {
            logger_1.logger.info(`Downloading file from URL: ${sourceUrl}`);
            const response = await fetch(sourceUrl);
            if (!response.ok) {
                throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            const originalName = this.getFileNameFromUrl(sourceUrl);
            return await this.storeVideo(buffer, originalName, workflow_id);
        }
        catch (error) {
            logger_1.logger.error(`Failed to store from URL ${sourceUrl}:`, error);
            throw error;
        }
    }
    async storeFromUrlWithProgress(sourceUrl, workflow_id, onProgress, cancellationToken) {
        try {
            logger_1.logger.info(`Downloading file from URL: ${sourceUrl}`);
            const response = await fetch(sourceUrl, { signal: cancellationToken });
            if (!response.ok) {
                throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
            }
            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const originalName = this.getFileNameFromUrl(sourceUrl);
            if (!response.body) {
                throw new Error('Response body is null');
            }
            const reader = response.body.getReader();
            const chunks = [];
            let downloaded = 0;
            while (true) {
                if (cancellationToken?.aborted) {
                    reader.cancel();
                    throw new Error('Download cancelled by user');
                }
                const { done, value } = await reader.read();
                if (done)
                    break;
                chunks.push(value);
                downloaded += value.length;
                if (onProgress && contentLength > 0) {
                    const percentage = Math.round((downloaded / contentLength) * 100);
                    onProgress(downloaded, contentLength, percentage);
                }
            }
            const buffer = Buffer.concat(chunks);
            return await this.storeVideo(buffer, originalName, workflow_id);
        }
        catch (error) {
            logger_1.logger.error(`Failed to store from URL ${sourceUrl}:`, error);
            throw error;
        }
    }
    async cleanupWorkflow(workflow_id) {
        try {
            const files = await fs_1.promises.readdir(this.tempDir);
            const workflowFiles = files.filter(file => file.includes(workflow_id));
            let filesDeleted = 0;
            let spaceFreed = 0;
            for (const file of workflowFiles) {
                try {
                    const filePath = path_1.default.join(this.tempDir, file);
                    const stats = await fs_1.promises.stat(filePath);
                    await fs_1.promises.unlink(filePath);
                    filesDeleted++;
                    spaceFreed += stats.size;
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to delete workflow file ${file}:`, error);
                }
            }
            if (filesDeleted > 0) {
                logger_1.logger.info(`Cleaned up ${filesDeleted} files for workflow ${workflow_id} (${spaceFreed} bytes freed)`);
            }
            return { filesDeleted, spaceFreed };
        }
        catch (error) {
            logger_1.logger.error(`Failed to cleanup workflow ${workflow_id}:`, error);
            return { filesDeleted: 0, spaceFreed: 0 };
        }
    }
    getMimeType(fileName) {
        const ext = path_1.default.extname(fileName).toLowerCase();
        switch (ext) {
            case '.mp4': return 'video/mp4';
            case '.wav': return 'audio/wav';
            case '.mp3': return 'audio/mp3';
            case '.txt': return 'text/plain';
            case '.json': return 'application/json';
            default: return 'application/octet-stream';
        }
    }
    getFileNameFromUrl(url) {
        try {
            const urlPath = new URL(url).pathname;
            return path_1.default.basename(urlPath) || 'video.mp4';
        }
        catch {
            return 'video.mp4';
        }
    }
    async getStats() {
        try {
            const files = await fs_1.promises.readdir(this.tempDir);
            const stats = {
                totalFiles: 0,
                totalSize: 0,
                videoFiles: 0,
                audioFiles: 0
            };
            for (const file of files) {
                try {
                    const filePath = path_1.default.join(this.tempDir, file);
                    const fileStats = await fs_1.promises.stat(filePath);
                    if (fileStats.isFile()) {
                        stats.totalFiles++;
                        stats.totalSize += fileStats.size;
                        if (file.startsWith('video_')) {
                            stats.videoFiles++;
                        }
                        else if (file.startsWith('audio_')) {
                            stats.audioFiles++;
                        }
                    }
                }
                catch (error) {
                }
            }
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Failed to get reference service stats:', error);
            return {
                totalFiles: 0,
                totalSize: 0,
                videoFiles: 0,
                audioFiles: 0
            };
        }
    }
}
exports.ReferenceService = ReferenceService;
//# sourceMappingURL=reference-service.js.map