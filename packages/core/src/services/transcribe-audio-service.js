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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscribeAudioService = void 0;
const transcription_service_1 = require("./transcription-service");
const logger_1 = require("../utils/logger");
class TranscribeAudioService {
    transcriptionService;
    transcriptions = new Map();
    constructor() {
        this.transcriptionService = new transcription_service_1.TranscriptionService();
    }
    async transcribeAudio(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Starting transcription for audioId: ${request.audioId}`);
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            await fs.promises.access(request.audioFilePath);
            const transcriptionResult = await this.transcriptionService.transcribeAudioFile(request.audioFilePath);
            const transcriptionId = `transcription_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            this.transcriptions.set(transcriptionId, transcriptionResult);
            const transcriptionTime = Date.now() - startTime;
            logger_1.logger.info(`Transcription completed for audioId: ${request.audioId} → transcriptionId: ${transcriptionId} in ${transcriptionTime}ms`);
            return {
                success: true,
                transcriptionId,
                rawText: transcriptionResult.fullText,
                segments: transcriptionResult.segments,
                language: transcriptionResult.language,
                confidence: transcriptionResult.confidence,
                duration: transcriptionResult.duration,
                transcriptionTime
            };
        }
        catch (error) {
            const transcriptionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Transcription failed for audioId: ${request.audioId}:`, error);
            return {
                success: false,
                transcriptionId: '',
                rawText: '',
                segments: [],
                language: 'en-US',
                confidence: 0,
                duration: 0,
                transcriptionTime,
                error: errorMessage
            };
        }
    }
    async getTranscription(transcriptionId) {
        return this.transcriptions.get(transcriptionId) || null;
    }
    async getRawText(transcriptionId) {
        const transcription = this.transcriptions.get(transcriptionId);
        return transcription ? transcription.fullText : null;
    }
    getStats() {
        return {
            activeTranscriptions: this.transcriptions.size,
            totalTranscribed: this.transcriptions.size
        };
    }
}
exports.TranscribeAudioService = TranscribeAudioService;
//# sourceMappingURL=transcribe-audio-service.js.map