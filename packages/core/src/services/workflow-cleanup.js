"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowCleanupService = void 0;
const service_manager_1 = require("./service-manager");
const logger_1 = require("../utils/logger");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class WorkflowCleanupService {
    tempDir;
    constructor(tempDir = './temp') {
        this.tempDir = tempDir;
    }
    async cleanupVideoAfterAudioExtraction(uploadId) {
        try {
            logger_1.logger.info(`Cleaning up video file after audio extraction for uploadId: ${uploadId}`);
            const serviceManager = service_manager_1.ServiceManager.getInstance();
            const uploadService = serviceManager.getUploadVideoService();
            const upload = await uploadService.getUploadedVideo(uploadId);
            if (!upload) {
                return {
                    success: false,
                    error: `Upload ${uploadId} not found`
                };
            }
            const spaceFreed = upload.size;
            const fileName = path_1.default.basename(upload.filePath);
            const deleted = await uploadService.deleteUploadedVideo(uploadId);
            if (deleted) {
                logger_1.logger.info(`Video file deleted after audio extraction: ${fileName} (${spaceFreed} bytes freed)`);
                return {
                    success: true,
                    fileDeleted: fileName,
                    spaceFreed
                };
            }
            else {
                return {
                    success: false,
                    error: `Failed to delete video file for uploadId: ${uploadId}`
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to cleanup video after audio extraction for ${uploadId}:`, error);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    async cleanupAudioAfterTranscription(audioId) {
        try {
            logger_1.logger.info(`Cleaning up audio file after transcription for audioId: ${audioId}`);
            const serviceManager = service_manager_1.ServiceManager.getInstance();
            const extractAudioService = serviceManager.getExtractAudioService();
            const audioFile = await extractAudioService.getAudioFile(audioId);
            if (!audioFile) {
                return {
                    success: false,
                    error: `Audio file ${audioId} not found`
                };
            }
            let spaceFreed = 0;
            try {
                const stats = await fs_1.promises.stat(audioFile.filePath);
                spaceFreed = stats.size;
            }
            catch (error) {
            }
            const fileName = path_1.default.basename(audioFile.filePath);
            const deleted = await extractAudioService.cleanupAudio(audioId);
            if (deleted) {
                logger_1.logger.info(`Audio file deleted after transcription: ${fileName} (${spaceFreed} bytes freed)`);
                return {
                    success: true,
                    fileDeleted: fileName,
                    spaceFreed
                };
            }
            else {
                return {
                    success: false,
                    error: `Failed to delete audio file for audioId: ${audioId}`
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Failed to cleanup audio after transcription for ${audioId}:`, error);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    async cleanupCompleteWorkflow(uploadId, audioId) {
        logger_1.logger.info(`Cleaning up complete workflow for uploadId: ${uploadId}`);
        const result = {
            videoCleanup: await this.cleanupVideoAfterAudioExtraction(uploadId)
        };
        if (audioId) {
            result.audioCleanup = await this.cleanupAudioAfterTranscription(audioId);
        }
        const totalSpaceFreed = (result.videoCleanup.spaceFreed || 0) + (result.audioCleanup?.spaceFreed || 0);
        logger_1.logger.info(`Complete workflow cleanup for ${uploadId}: ${totalSpaceFreed} bytes freed`);
        return result;
    }
    async getWorkflowStats() {
        const serviceManager = service_manager_1.ServiceManager.getInstance();
        const uploadService = serviceManager.getUploadVideoService();
        const uploadStats = uploadService.getStats();
        let activeAudioFiles = 0;
        let totalAudioSize = 0;
        try {
            const files = await fs_1.promises.readdir(this.tempDir);
            const audioFiles = files.filter(file => file.endsWith('.wav') || file.endsWith('.mp3'));
            activeAudioFiles = audioFiles.length;
            for (const file of audioFiles) {
                try {
                    const filePath = path_1.default.join(this.tempDir, file);
                    const stats = await fs_1.promises.stat(filePath);
                    totalAudioSize += stats.size;
                }
                catch (error) {
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to get audio file stats:', error);
        }
        return {
            activeVideos: uploadStats.activeUploads,
            activeAudioFiles,
            totalVideoSize: uploadStats.totalSize,
            totalAudioSize
        };
    }
}
exports.WorkflowCleanupService = WorkflowCleanupService;
//# sourceMappingURL=workflow-cleanup.js.map