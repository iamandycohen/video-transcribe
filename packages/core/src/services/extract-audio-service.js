"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractAudioService = void 0;
const audio_extractor_1 = require("./audio-extractor");
const upload_video_service_1 = require("./upload-video-service");
const logger_1 = require("../utils/logger");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class ExtractAudioService {
    audioExtractor;
    uploadService;
    audioFiles = new Map();
    constructor(uploadService) {
        this.audioExtractor = new audio_extractor_1.AudioExtractorService();
        this.uploadService = uploadService || new upload_video_service_1.UploadVideoService();
    }
    async extractAudio(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Starting audio extraction for uploadId: ${request.uploadId}`);
            const videoFilePath = path_1.default.join('./temp/uploads', `${request.uploadId}.mp4`);
            try {
                await fs_1.promises.access(videoFilePath);
            }
            catch (error) {
                throw new Error('Video file not found for uploadId');
            }
            const isValid = await this.audioExtractor.validateMp4File(videoFilePath);
            if (!isValid) {
                throw new Error('Invalid MP4 file');
            }
            const audioResult = await this.audioExtractor.extractAudioFromMp4(videoFilePath);
            const audioId = `audio_${request.uploadId}_${Date.now()}`;
            this.audioFiles.set(audioId, {
                filePath: audioResult.audioFilePath,
                originalVideoName: `video_${request.uploadId}.mp4`,
                createdAt: new Date()
            });
            const extractionTime = Date.now() - startTime;
            logger_1.logger.info(`Audio extraction completed for uploadId: ${request.uploadId} → audioId: ${audioId} in ${extractionTime}ms`);
            return {
                success: true,
                audioId,
                audioFilePath: audioResult.audioFilePath,
                originalVideoName: `video_${request.uploadId}.mp4`,
                extractionTime
            };
        }
        catch (error) {
            const extractionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Audio extraction failed for uploadId: ${request.uploadId}:`, error);
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
    async extractAudioFromPath(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Starting audio extraction from path: ${request.filePath}`);
            const isValid = await this.audioExtractor.validateMp4File(request.filePath);
            if (!isValid) {
                throw new Error('Invalid MP4 file');
            }
            const audioResult = await this.audioExtractor.extractAudioFromMp4(request.filePath);
            const audioId = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            this.audioFiles.set(audioId, {
                filePath: audioResult.audioFilePath,
                originalVideoName: request.originalName,
                createdAt: new Date()
            });
            const extractionTime = Date.now() - startTime;
            logger_1.logger.info(`Audio extraction completed from path → audioId: ${audioId} in ${extractionTime}ms`);
            return {
                success: true,
                audioId,
                audioFilePath: audioResult.audioFilePath,
                originalVideoName: request.originalName,
                extractionTime
            };
        }
        catch (error) {
            const extractionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Audio extraction failed from path: ${request.filePath}:`, error);
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
    async getAudioFile(audioId) {
        const audioFile = this.audioFiles.get(audioId);
        if (!audioFile) {
            return null;
        }
        try {
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            await fs.promises.access(audioFile.filePath);
            return {
                filePath: audioFile.filePath,
                originalVideoName: audioFile.originalVideoName
            };
        }
        catch (error) {
            this.audioFiles.delete(audioId);
            return null;
        }
    }
    async cleanupAudio(audioId) {
        try {
            const audioFile = this.audioFiles.get(audioId);
            if (audioFile) {
                await this.audioExtractor.cleanup(audioFile.filePath);
                this.audioFiles.delete(audioId);
                logger_1.logger.info(`Cleaned up audio file: ${audioId}`);
                return true;
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error(`Failed to cleanup audio file ${audioId}:`, error);
            return false;
        }
    }
    getStats() {
        return {
            activeAudioFiles: this.audioFiles.size,
            totalExtracted: this.audioFiles.size
        };
    }
}
exports.ExtractAudioService = ExtractAudioService;
//# sourceMappingURL=extract-audio-service.js.map