"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadVideoService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
class UploadVideoService {
    uploads = new Map();
    tempDir;
    defaultExpirationHours;
    constructor(options = {}) {
        this.tempDir = options.tempDir || './temp/uploads';
        this.defaultExpirationHours = options.expirationHours || 24;
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
    async storeVideo(file) {
        try {
            const uploadId = (0, uuid_1.v4)();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + this.defaultExpirationHours * 60 * 60 * 1000);
            if (file.mimetype !== 'video/mp4') {
                throw new Error('Only MP4 files are supported');
            }
            const uploadedVideo = {
                uploadId,
                originalName: file.originalname,
                filePath: file.path,
                mimeType: file.mimetype,
                size: file.size,
                uploadedAt: now,
                expiresAt
            };
            this.uploads.set(uploadId, uploadedVideo);
            logger_1.logger.info(`Video stored successfully: ${uploadId} (${file.originalname})`);
            return {
                uploadId,
                originalName: file.originalname,
                size: file.size,
                uploadedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                message: 'Video uploaded successfully. Use the uploadId to process the video.'
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to store video:', error);
            throw error;
        }
    }
    async storeVideoFromPath(filePath) {
        try {
            const stats = await fs_1.promises.stat(filePath);
            const originalName = path_1.default.basename(filePath);
            const uploadId = (0, uuid_1.v4)();
            const targetPath = path_1.default.join(this.tempDir, `${uploadId}.mp4`);
            await fs_1.promises.copyFile(filePath, targetPath);
            const file = {
                originalname: originalName,
                path: targetPath,
                mimetype: 'video/mp4',
                size: stats.size
            };
            return await this.storeVideo(file);
        }
        catch (error) {
            logger_1.logger.error('Failed to store video from path:', error);
            throw error;
        }
    }
    async storeVideoFromUrl(url) {
        try {
            logger_1.logger.info(`Downloading video from URL: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
            }
            const urlPath = new URL(url).pathname;
            const originalName = path_1.default.basename(urlPath) || 'video.mp4';
            const uploadId = (0, uuid_1.v4)();
            const targetPath = path_1.default.join(this.tempDir, `${uploadId}.mp4`);
            const arrayBuffer = await response.arrayBuffer();
            await fs_1.promises.writeFile(targetPath, Buffer.from(arrayBuffer));
            logger_1.logger.info(`Video downloaded successfully: ${arrayBuffer.byteLength} bytes`);
            const now = new Date();
            const expiresAt = new Date(now.getTime() + this.defaultExpirationHours * 60 * 60 * 1000);
            const uploadedVideo = {
                uploadId,
                originalName,
                filePath: targetPath,
                mimeType: 'video/mp4',
                size: arrayBuffer.byteLength,
                uploadedAt: now,
                expiresAt
            };
            this.uploads.set(uploadId, uploadedVideo);
            logger_1.logger.info(`Video stored successfully: ${uploadId} (${originalName})`);
            return {
                uploadId,
                originalName,
                size: arrayBuffer.byteLength,
                uploadedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                message: 'Video uploaded successfully. Use the uploadId to process the video.'
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to store video from URL:', error);
            throw error;
        }
    }
    async getUploadedVideo(uploadId) {
        const upload = this.uploads.get(uploadId);
        if (!upload) {
            return null;
        }
        if (new Date() > upload.expiresAt) {
            await this.deleteUploadedVideo(uploadId);
            return null;
        }
        return upload;
    }
    async deleteUploadedVideo(uploadId) {
        try {
            const upload = this.uploads.get(uploadId);
            if (upload) {
                try {
                    await fs_1.promises.unlink(upload.filePath);
                }
                catch (fileError) {
                    logger_1.logger.warn(`Could not delete file for upload ${uploadId}:`, fileError);
                }
                this.uploads.delete(uploadId);
                logger_1.logger.info(`Deleted uploaded video: ${uploadId}`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete uploaded video ${uploadId}:`, error);
            return false;
        }
    }
    async cleanupExpiredUploads() {
        const now = new Date();
        let cleaned = 0;
        for (const [uploadId, upload] of this.uploads.entries()) {
            if (now > upload.expiresAt) {
                await this.deleteUploadedVideo(uploadId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger_1.logger.info(`Cleaned up ${cleaned} expired uploads`);
        }
        return cleaned;
    }
    getStats() {
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
exports.UploadVideoService = UploadVideoService;
//# sourceMappingURL=upload-video-service.js.map