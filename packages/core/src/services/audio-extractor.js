"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioExtractorService = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const azure_config_1 = require("../config/azure-config");
const logger_1 = require("../utils/logger");
const ffprobeStatic = require('ffprobe-static');
if (ffmpeg_static_1.default) {
    fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
}
if (ffprobeStatic?.path) {
    fluent_ffmpeg_1.default.setFfprobePath(ffprobeStatic.path);
}
class AudioExtractorService {
    tempDir;
    constructor() {
        this.tempDir = azure_config_1.azureConfig.app.tempDir;
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
    async extractAudioFromMp4(mp4FilePath, onProgress) {
        const startTime = Date.now();
        const audioFileName = `${(0, uuid_1.v4)()}.wav`;
        const audioFilePath = path_1.default.join(this.tempDir, audioFileName);
        logger_1.logger.info(`Starting audio extraction from: ${mp4FilePath}`);
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(mp4FilePath)
                .audioCodec('pcm_s16le')
                .audioChannels(1)
                .audioFrequency(16000)
                .format('wav')
                .on('start', (commandLine) => {
                logger_1.logger.debug(`FFmpeg command: ${commandLine}`);
            })
                .on('progress', (progress) => {
                if (progress.percent) {
                    const percent = Math.round(progress.percent);
                    logger_1.logger.debug(`Audio extraction progress: ${percent}%`);
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
                logger_1.logger.info(`Audio extraction completed in ${duration}ms: ${audioFilePath}`);
                fluent_ffmpeg_1.default.ffprobe(audioFilePath, (err, metadata) => {
                    if (err) {
                        logger_1.logger.error('Failed to get audio metadata:', err);
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
                logger_1.logger.error('Audio extraction failed:', error);
                reject(error);
            })
                .save(audioFilePath);
        });
    }
    async cleanup(audioFilePath) {
        try {
            await fs_1.promises.unlink(audioFilePath);
            logger_1.logger.info(`Cleaned up temporary file: ${audioFilePath}`);
        }
        catch (error) {
            logger_1.logger.warn(`Failed to cleanup file ${audioFilePath}:`, error);
        }
    }
    async validateMp4File(filePath) {
        try {
            await fs_1.promises.access(filePath);
            return new Promise((resolve) => {
                fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
                    if (err) {
                        logger_1.logger.error('Invalid MP4 file:', err);
                        resolve(false);
                        return;
                    }
                    const hasVideo = metadata.streams.some(stream => stream.codec_type === 'video');
                    const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
                    if (!hasAudio) {
                        logger_1.logger.warn('MP4 file has no audio track');
                    }
                    resolve(hasVideo && hasAudio);
                });
            });
        }
        catch (error) {
            logger_1.logger.error('File access error:', error);
            return false;
        }
    }
}
exports.AudioExtractorService = AudioExtractorService;
//# sourceMappingURL=audio-extractor.js.map