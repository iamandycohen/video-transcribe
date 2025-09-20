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
exports.TranscriptionService = void 0;
const speechSdk = __importStar(require("microsoft-cognitiveservices-speech-sdk"));
const fs_1 = require("fs");
const azure_client_1 = require("./azure-client");
const logger_1 = require("../utils/logger");
class TranscriptionService {
    azureClient;
    constructor() {
        this.azureClient = new azure_client_1.AzureClientService();
    }
    async transcribeAudioFile(audioFilePath) {
        const startTime = Date.now();
        logger_1.logger.info(`Starting transcription of: ${audioFilePath}`);
        try {
            await fs_1.promises.access(audioFilePath);
            const speechConfig = this.azureClient.getSpeechConfig();
            const audioConfig = speechSdk.AudioConfig.fromWavFileInput(await fs_1.promises.readFile(audioFilePath));
            const recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);
            const segments = [];
            let fullText = '';
            return new Promise((resolve, reject) => {
                recognizer.recognized = (s, e) => {
                    if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
                        const result = e.result;
                        const segment = {
                            text: result.text,
                            startTime: result.offset / 10000,
                            endTime: (result.offset + result.duration) / 10000,
                            confidence: this.extractConfidence(result)
                        };
                        segments.push(segment);
                        fullText += result.text + ' ';
                        logger_1.logger.debug(`Recognized: ${result.text}`);
                    }
                };
                recognizer.sessionStarted = (_s, _e) => {
                    logger_1.logger.debug('Transcription session started');
                };
                recognizer.sessionStopped = (_s, _e) => {
                    logger_1.logger.debug('Transcription session stopped');
                    const duration = Date.now() - startTime;
                    const avgConfidence = segments.length > 0
                        ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length
                        : 0;
                    const result = {
                        fullText: fullText.trim(),
                        segments,
                        duration,
                        language: 'en-US',
                        confidence: avgConfidence
                    };
                    logger_1.logger.info(`Transcription completed in ${duration}ms with ${segments.length} segments`);
                    resolve(result);
                };
                recognizer.canceled = (s, e) => {
                    if (e.reason === speechSdk.CancellationReason.Error) {
                        const error = new Error(`Transcription failed: ${e.errorDetails}`);
                        logger_1.logger.error('Transcription canceled:', error);
                        reject(error);
                    }
                };
                recognizer.startContinuousRecognitionAsync(() => {
                    logger_1.logger.debug('Continuous recognition started');
                }, (error) => {
                    logger_1.logger.error('Failed to start recognition:', error);
                    reject(error);
                });
                recognizer.recognizing = (s, e) => {
                    if (e.result.reason === speechSdk.ResultReason.RecognizingSpeech) {
                        logger_1.logger.debug(`Recognizing: ${e.result.text}`);
                    }
                };
            });
        }
        catch (error) {
            logger_1.logger.error('Transcription failed:', error);
            throw error;
        }
    }
    extractConfidence(result) {
        try {
            const detailedResult = JSON.parse(result.properties.getProperty(speechSdk.PropertyId.SpeechServiceResponse_JsonResult));
            if (detailedResult?.NBest?.[0]?.Confidence) {
                return detailedResult.NBest[0].Confidence;
            }
        }
        catch (error) {
            logger_1.logger.debug('Could not extract confidence score:', error);
        }
        return 0.85;
    }
    async transcribeWithDiarization(audioFilePath) {
        logger_1.logger.info('Diarization requested, falling back to standard transcription');
        return this.transcribeAudioFile(audioFilePath);
    }
}
exports.TranscriptionService = TranscriptionService;
//# sourceMappingURL=transcription-service.js.map