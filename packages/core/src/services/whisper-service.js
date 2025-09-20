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
exports.WhisperService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const logger_1 = require("../utils/logger");
process.env.ORT_LOGGING_LEVEL = '3';
process.env.ONNXJS_LOG_LEVEL = 'error';
process.env.TRANSFORMERS_VERBOSITY = 'error';
const QUALITY_MODEL_MAP = {
    fast: 'tiny',
    balanced: 'base',
    accurate: 'medium',
    best: 'large'
};
const MODEL_SIZES = {
    tiny: { size: '39MB', speed: 'fastest', accuracy: 'lowest' },
    base: { size: '74MB', speed: 'fast', accuracy: 'good' },
    small: { size: '244MB', speed: 'medium', accuracy: 'better' },
    medium: { size: '769MB', speed: 'slower', accuracy: 'high' },
    large: { size: '1550MB', speed: 'slowest', accuracy: 'highest' }
};
class WhisperService {
    cacheDir;
    nodeWhisper = null;
    constructor(options = {}) {
        this.cacheDir = options.cacheDir || path_1.default.join(os_1.default.homedir(), '.cache', 'video-transcribe', 'whisper');
        this.ensureCacheDir();
    }
    async transcribeAudio(audioPath, options = {}, onProgress) {
        const startTime = Date.now();
        try {
            const model = this.resolveModel(options);
            logger_1.logger.info(`Starting Whisper transcription with model: ${model}`);
            await this.ensureModelAvailable(model, onProgress);
            await this.loadNodeWhisper(model);
            if (onProgress) {
                onProgress({
                    type: 'transcription',
                    progress: 0,
                    message: `🎙️ Transcribing with ${model} model...`,
                    timestamp: Date.now()
                });
            }
            const audioDuration = await this.getAudioDuration(audioPath);
            const chunkSize = 30;
            const strideSize = 5;
            const stepSize = chunkSize - strideSize;
            const estimatedChunks = audioDuration > 0 ? Math.ceil(audioDuration / stepSize) : 1;
            if (onProgress && audioDuration > 30) {
                onProgress({
                    type: 'transcription',
                    progress: 10,
                    message: `🎙️ Processing ${audioDuration.toFixed(1)}s audio in ~${estimatedChunks} chunks...`,
                    metadata: {
                        totalSteps: estimatedChunks,
                        estimatedTimeRemaining: audioDuration * 1000
                    },
                    timestamp: Date.now()
                });
            }
            const audioData = await this.processAudioForNode(audioPath);
            if (onProgress) {
                onProgress({
                    type: 'transcription',
                    progress: 20,
                    message: `🎙️ Audio prepared, starting transcription...`,
                    timestamp: Date.now()
                });
            }
            let progressTimer = null;
            let currentProgress = 20;
            if (onProgress && audioDuration > 10) {
                progressTimer = setInterval(() => {
                    currentProgress = Math.min(90, currentProgress + 3);
                    const processedChunks = Math.round((currentProgress - 20) / 70 * estimatedChunks);
                    onProgress({
                        type: 'transcription',
                        progress: currentProgress,
                        message: `🎙️ Transcribing... (~${processedChunks} chunks processed)`,
                        metadata: {
                            step: processedChunks,
                            totalSteps: estimatedChunks,
                            estimatedTimeRemaining: ((100 - currentProgress) / 100) * audioDuration * 1000
                        },
                        timestamp: Date.now()
                    });
                }, 2000);
            }
            const shouldSuppressWarnings = process.env.WHISPER_SUPPRESS_WARNINGS === 'true';
            const originalStderrWrite = process.stderr.write;
            if (shouldSuppressWarnings) {
                process.stderr.write = function (chunk, encoding, callback) {
                    const str = chunk.toString();
                    if (str.includes('W:onnxruntime') || str.includes('onnxruntime::Graph::CleanUnusedInitializersAndNodeArgs')) {
                        if (typeof encoding === 'function') {
                            encoding();
                        }
                        else if (typeof callback === 'function') {
                            callback();
                        }
                        return true;
                    }
                    return originalStderrWrite.call(this, chunk, encoding, callback);
                };
            }
            const result = await this.nodeWhisper(audioData, {
                language: options.language || null,
                return_timestamps: true,
                chunk_length_s: 30,
                stride_length_s: 5
            });
            if (shouldSuppressWarnings) {
                process.stderr.write = originalStderrWrite;
            }
            if (progressTimer) {
                clearInterval(progressTimer);
            }
            const processingTime = Date.now() - startTime;
            if (onProgress) {
                onProgress({
                    type: 'transcription',
                    progress: 100,
                    message: `✅ Transcription complete (${(processingTime / 1000).toFixed(1)}s)`,
                    metadata: {
                        step: estimatedChunks,
                        totalSteps: estimatedChunks,
                        speed: `${(audioDuration / (processingTime / 1000)).toFixed(1)}x realtime`
                    },
                    timestamp: Date.now()
                });
            }
            return this.parseWhisperResult(result, processingTime);
        }
        catch (error) {
            logger_1.logger.error('Whisper transcription failed:', error);
            throw this.handleWhisperError(error, options);
        }
    }
    async healthCheck() {
        try {
            await this.loadNodeWhisper('base');
            await fs_1.default.promises.access(this.cacheDir, fs_1.default.constants.W_OK);
            return {
                status: 'healthy',
                message: 'Whisper service is ready for local transcription'
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: `Whisper service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    getModelInfo() {
        const info = {};
        for (const [model, details] of Object.entries(MODEL_SIZES)) {
            info[model] = {
                ...details,
                cached: this.isModelCached(model)
            };
        }
        return info;
    }
    async downloadModel(model, onProgress) {
        if (this.isModelCached(model)) {
            logger_1.logger.info(`Model ${model} is already cached`);
            return;
        }
        await this.ensureModelAvailable(model, onProgress);
    }
    async clearCache() {
        if (fs_1.default.existsSync(this.cacheDir)) {
            await fs_1.default.promises.rm(this.cacheDir, { recursive: true });
            this.ensureCacheDir();
            logger_1.logger.info('Whisper model cache cleared');
        }
    }
    resolveModel(options) {
        if (options.model) {
            return options.model;
        }
        if (options.quality) {
            return QUALITY_MODEL_MAP[options.quality];
        }
        return 'base';
    }
    async loadNodeWhisper(model) {
        if (this.nodeWhisper)
            return;
        const shouldSuppressWarnings = process.env.WHISPER_SUPPRESS_WARNINGS === 'true';
        const originalStderrWrite = process.stderr.write;
        try {
            if (shouldSuppressWarnings) {
                process.stderr.write = function (chunk, encoding, callback) {
                    const str = chunk.toString();
                    if (str.includes('W:onnxruntime') || str.includes('onnxruntime::Graph::CleanUnusedInitializersAndNodeArgs')) {
                        if (typeof encoding === 'function') {
                            encoding();
                        }
                        else if (typeof callback === 'function') {
                            callback();
                        }
                        return true;
                    }
                    return originalStderrWrite.call(this, chunk, encoding, callback);
                };
            }
            const transformers = require('@xenova/transformers');
            const { pipeline } = transformers;
            const modelMap = {
                'tiny': 'Xenova/whisper-tiny',
                'base': 'Xenova/whisper-base',
                'small': 'Xenova/whisper-small',
                'medium': 'Xenova/whisper-medium',
                'large': 'Xenova/whisper-medium'
            };
            const modelName = modelMap[model] || 'Xenova/whisper-base';
            logger_1.logger.debug(`Loading Whisper model: ${modelName} (mapped from ${model})`);
            this.nodeWhisper = await pipeline('automatic-speech-recognition', modelName, {
                cache_dir: this.cacheDir
            });
            logger_1.logger.debug(`@xenova/transformers whisper pipeline loaded successfully: ${modelName}`);
            if (shouldSuppressWarnings) {
                process.stderr.write = originalStderrWrite;
            }
        }
        catch (error) {
            if (shouldSuppressWarnings) {
                process.stderr.write = originalStderrWrite;
            }
            logger_1.logger.error('Failed to load @xenova/transformers:', error);
            throw new Error(`Failed to load Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async ensureModelAvailable(model, onProgress) {
        if (this.isModelCached(model)) {
            if (onProgress) {
                onProgress({
                    type: 'download',
                    progress: 100,
                    message: `✅ Model ${model} cached (${MODEL_SIZES[model].size})`
                });
            }
            return;
        }
        await this.downloadModelFromSource(model, onProgress);
    }
    async downloadModelFromSource(model, onProgress) {
        const modelInfo = MODEL_SIZES[model];
        if (onProgress) {
            onProgress({
                type: 'download',
                progress: 0,
                message: `⬬ Downloading ${model} model (${modelInfo.size})...`
            });
        }
        try {
            await this.loadNodeWhisper(model);
            logger_1.logger.info(`Whisper model ${model} will be downloaded automatically on first use`);
            const modelPath = this.getModelPath(model);
            await fs_1.default.promises.writeFile(modelPath, `whisper-${model}-model-marker`);
            if (onProgress) {
                onProgress({
                    type: 'download',
                    progress: 100,
                    message: `✅ Model ${model} prepared (${modelInfo.size})`
                });
            }
            logger_1.logger.info(`Whisper model ${model} ready for use`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to prepare Whisper model ${model}:`, error);
            throw new Error(`Failed to prepare ${model} model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    isModelCached(model) {
        const modelPath = this.getModelPath(model);
        return fs_1.default.existsSync(modelPath);
    }
    getModelPath(model) {
        return path_1.default.join(this.cacheDir, `${model}.pt`);
    }
    ensureCacheDir() {
        if (!fs_1.default.existsSync(this.cacheDir)) {
            fs_1.default.mkdirSync(this.cacheDir, { recursive: true });
            logger_1.logger.debug(`Created Whisper cache directory: ${this.cacheDir}`);
        }
    }
    parseWhisperResult(result, processingTime) {
        const fullText = result.text || '';
        let segments = [];
        if (result.chunks && Array.isArray(result.chunks)) {
            segments = result.chunks.map((chunk) => ({
                start: chunk.timestamp?.[0] || 0,
                end: chunk.timestamp?.[1] || 0,
                text: chunk.text || ''
            }));
        }
        else {
            segments = [{
                    start: 0,
                    end: 0,
                    text: fullText
                }];
        }
        const duration = segments.length > 0 && segments[segments.length - 1].end > 0
            ? segments[segments.length - 1].end
            : Math.max(fullText.length * 0.1, 1);
        return {
            text: fullText,
            segments: segments,
            language: 'auto-detected',
            duration: duration * 1000,
            processingTime
        };
    }
    async getAudioDuration(audioPath) {
        try {
            const ffprobeStatic = require('ffprobe-static');
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const command = `"${ffprobeStatic.path}" -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
            const output = execSync(command, { encoding: 'utf8' }).toString().trim();
            return parseFloat(output) || 0;
        }
        catch (error) {
            logger_1.logger.warn('Failed to get audio duration, using estimation:', error);
            return 0;
        }
    }
    async processAudioForNode(audioPath) {
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const fs = await Promise.resolve().then(() => __importStar(require('fs')));
            const path = await Promise.resolve().then(() => __importStar(require('path')));
            const os = await Promise.resolve().then(() => __importStar(require('os')));
            const tempRawFile = path.join(os.tmpdir(), `whisper-raw-${Date.now()}.raw`);
            const ffmpegStatic = await Promise.resolve().then(() => __importStar(require('ffmpeg-static')));
            const ffmpegPath = ffmpegStatic.default;
            if (!ffmpegPath) {
                throw new Error('FFmpeg binary not found. Please install ffmpeg-static.');
            }
            const ffmpegCmd = `"${ffmpegPath}" -i "${audioPath}" -ar 16000 -ac 1 -f f32le -acodec pcm_f32le "${tempRawFile}" -y`;
            logger_1.logger.debug(`Converting audio for Whisper: ${ffmpegCmd}`);
            execSync(ffmpegCmd, { stdio: 'pipe' });
            const rawBuffer = fs.readFileSync(tempRawFile);
            const audioData = new Float32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);
            fs.unlinkSync(tempRawFile);
            logger_1.logger.debug(`Processed audio: ${audioData.length} samples at 16kHz`);
            return audioData;
        }
        catch (error) {
            logger_1.logger.error('Failed to process audio for Whisper:', error);
            throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    handleWhisperError(error, options) {
        const message = error instanceof Error ? error.message : 'Unknown Whisper error';
        if (message.includes('memory') || message.includes('OOM')) {
            const currentModel = this.resolveModel(options);
            const suggestions = this.getSmallerModelSuggestions(currentModel);
            return new Error(`❌ Out of memory error with '${currentModel}' model.\n` +
                `💡 Try a smaller model: ${suggestions.join(' or ')}\n` +
                `💡 Or use cloud transcription by removing --local-whisper flag`);
        }
        if (message.includes('network') || message.includes('download')) {
            return new Error(`❌ Network error during model download.\n` +
                `💡 Check your internet connection and try again\n` +
                `💡 Or use cloud transcription by removing --local-whisper flag`);
        }
        if (message.includes('not found') || message.includes('ENOENT')) {
            return new Error(`❌ Model file not found or corrupted.\n` +
                `💡 Try clearing cache and re-downloading: --whisper-clear-cache\n` +
                `💡 Or use cloud transcription by removing --local-whisper flag`);
        }
        return new Error(`Whisper transcription failed: ${message}`);
    }
    getSmallerModelSuggestions(currentModel) {
        const modelOrder = ['tiny', 'base', 'small', 'medium', 'large'];
        const currentIndex = modelOrder.indexOf(currentModel);
        if (currentIndex <= 0)
            return ['base'];
        return modelOrder.slice(0, currentIndex);
    }
}
exports.WhisperService = WhisperService;
//# sourceMappingURL=whisper-service.js.map