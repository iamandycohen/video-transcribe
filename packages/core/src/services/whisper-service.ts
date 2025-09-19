import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';
import { ProgressCallback } from '../types/progress';

// Set environment variables to attempt to suppress ONNX Runtime warnings
// Note: These warnings come from the native C++ ONNX runtime and are difficult to suppress completely
// Users can set WHISPER_SUPPRESS_WARNINGS=true to enable stderr filtering
process.env.ORT_LOGGING_LEVEL = '3'; // Error level only (0=Verbose, 1=Info, 2=Warning, 3=Error, 4=Fatal)
process.env.ONNXJS_LOG_LEVEL = 'error';
process.env.TRANSFORMERS_VERBOSITY = 'error';

/**
 * Whisper model quality to model name mapping
 */
const QUALITY_MODEL_MAP = {
  fast: 'tiny',
  balanced: 'base', 
  accurate: 'medium',
  best: 'large'
} as const;

/**
 * Model size information for user feedback
 */
const MODEL_SIZES = {
  tiny: { size: '39MB', speed: 'fastest', accuracy: 'lowest' },
  base: { size: '74MB', speed: 'fast', accuracy: 'good' },
  small: { size: '244MB', speed: 'medium', accuracy: 'better' },
  medium: { size: '769MB', speed: 'slower', accuracy: 'high' },
  large: { size: '1550MB', speed: 'slowest', accuracy: 'highest' }
} as const;

export type WhisperModel = keyof typeof MODEL_SIZES;
export type WhisperQuality = keyof typeof QUALITY_MODEL_MAP;

export interface WhisperOptions {
  model?: WhisperModel;
  quality?: WhisperQuality;
  language?: string;
  cacheDir?: string;
  verbose?: boolean;
}

export interface WhisperResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  language: string;
  duration: number;
  processingTime: number;
}

export interface WhisperProgress {
  type: 'download' | 'transcription';
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export class WhisperService {
  private cacheDir: string;
  private nodeWhisper: any = null;

  constructor(options: { cacheDir?: string } = {}) {
    this.cacheDir = options.cacheDir || path.join(os.homedir(), '.cache', 'video-transcribe', 'whisper');
    this.ensureCacheDir();
  }

  /**
   * Transcribe audio file using local Whisper
   */
  async transcribeAudio(
    audioPath: string,
    options: WhisperOptions = {},
    onProgress?: ProgressCallback
  ): Promise<WhisperResult> {
    const startTime = Date.now();
    
    try {
      // Determine model to use
      const model = this.resolveModel(options);
      logger.info(`Starting Whisper transcription with model: ${model}`);

      // Ensure model is available
      await this.ensureModelAvailable(model, onProgress);

      // Load node-whisper dynamically with the specific model
      await this.loadNodeWhisper(model);

      // Report transcription start
      if (onProgress) {
        onProgress({
          type: 'transcription',
          progress: 0,
          message: `🎙️ Transcribing with ${model} model...`,
          timestamp: Date.now()
        });
      }

      // Get audio duration for progress estimation
      const audioDuration = await this.getAudioDuration(audioPath);
      const chunkSize = 30; // 30 seconds
      const strideSize = 5; // 5 seconds overlap
      const stepSize = chunkSize - strideSize; // 25 seconds effective progress per chunk
      const estimatedChunks = audioDuration > 0 ? Math.ceil(audioDuration / stepSize) : 1;

      if (onProgress && audioDuration > 30) {
        onProgress({
          type: 'transcription',
          progress: 10,
          message: `🎙️ Processing ${audioDuration.toFixed(1)}s audio in ~${estimatedChunks} chunks...`,
          metadata: {
            totalSteps: estimatedChunks,
            estimatedTimeRemaining: audioDuration * 1000 // rough estimate
          },
          timestamp: Date.now()
        });
      }

      // Process audio data for Node.js environment
      const audioData = await this.processAudioForNode(audioPath);
      
      if (onProgress) {
        onProgress({
          type: 'transcription',
          progress: 20,
          message: `🎙️ Audio prepared, starting transcription...`,
          timestamp: Date.now()
        });
      }

      // Start progress timer for estimation during transcription
      let progressTimer: NodeJS.Timeout | null = null;
      let currentProgress = 20;
      
      if (onProgress && audioDuration > 10) {
        // Update progress every 2 seconds with estimation
        progressTimer = setInterval(() => {
          currentProgress = Math.min(90, currentProgress + 3); // Gradual increase, max 90%
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
      
      // Perform transcription using @xenova/transformers
      // Configure chunking for long audio files (>30 seconds)
      
      // Conditionally suppress stderr during transcription too
      const shouldSuppressWarnings = process.env.WHISPER_SUPPRESS_WARNINGS === 'true';
      const originalStderrWrite = process.stderr.write;
      
      if (shouldSuppressWarnings) {
        process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
          const str = chunk.toString();
          // Filter out ONNX runtime warnings
          if (str.includes('W:onnxruntime') || str.includes('onnxruntime::Graph::CleanUnusedInitializersAndNodeArgs')) {
            // Silently ignore these warnings
            if (typeof encoding === 'function') {
              encoding(); // callback was passed as second argument
            } else if (typeof callback === 'function') {
              callback();
            }
            return true;
          }
          // Pass through other messages
          return originalStderrWrite.call(this, chunk, encoding, callback);
        };
      }

      const result = await this.nodeWhisper(audioData, {
        language: options.language || null, // null for auto-detect
        return_timestamps: true,
        // Enable chunking for long audio files
        chunk_length_s: 30,          // Process in 30-second chunks
        stride_length_s: 5           // 5-second overlap between chunks for accuracy
      });

      // Restore stderr if we modified it
      if (shouldSuppressWarnings) {
        process.stderr.write = originalStderrWrite;
      }
      
      // Clear progress timer
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      
      const processingTime = Date.now() - startTime;
      
      // Report completion
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

      // Parse and return result
      return this.parseWhisperResult(result, processingTime);

    } catch (error) {
      logger.error('Whisper transcription failed:', error);
      throw this.handleWhisperError(error, options);
    }
  }

  /**
   * Check if Whisper is available and models can be downloaded
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.loadNodeWhisper('base');
      
      // Check if we can access the cache directory
      await fs.promises.access(this.cacheDir, fs.constants.W_OK);
      
      return {
        status: 'healthy',
        message: 'Whisper service is ready for local transcription'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Whisper service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get information about available models
   */
  getModelInfo(): Record<WhisperModel, typeof MODEL_SIZES[WhisperModel] & { cached: boolean }> {
    const info = {} as any;
    
    for (const [model, details] of Object.entries(MODEL_SIZES)) {
      info[model] = {
        ...details,
        cached: this.isModelCached(model as WhisperModel)
      };
    }
    
    return info;
  }

  /**
   * Pre-download a model for later use
   */
  async downloadModel(
    model: WhisperModel,
    onProgress?: (progress: WhisperProgress) => void
  ): Promise<void> {
    if (this.isModelCached(model)) {
      logger.info(`Model ${model} is already cached`);
      return;
    }

    await this.ensureModelAvailable(model, onProgress);
  }


  /**
   * Clear model cache
   */
  async clearCache(): Promise<void> {
    if (fs.existsSync(this.cacheDir)) {
      await fs.promises.rm(this.cacheDir, { recursive: true });
      this.ensureCacheDir();
      logger.info('Whisper model cache cleared');
    }
  }

  // Private methods

  private resolveModel(options: WhisperOptions): WhisperModel {
    if (options.model) {
      return options.model;
    }
    if (options.quality) {
      return QUALITY_MODEL_MAP[options.quality];
    }
    return 'base'; // Default to balanced quality
  }

  private async loadNodeWhisper(model: WhisperModel): Promise<void> {
    if (this.nodeWhisper) return;

    // Conditionally suppress stderr output to hide ONNX Runtime warnings
    const shouldSuppressWarnings = process.env.WHISPER_SUPPRESS_WARNINGS === 'true';
    const originalStderrWrite = process.stderr.write;

    try {
      if (shouldSuppressWarnings) {
        process.stderr.write = function(chunk: any, encoding?: any, callback?: any) {
          const str = chunk.toString();
          // Filter out ONNX runtime warnings
          if (str.includes('W:onnxruntime') || str.includes('onnxruntime::Graph::CleanUnusedInitializersAndNodeArgs')) {
            // Silently ignore these warnings
            if (typeof encoding === 'function') {
              encoding(); // callback was passed as second argument
            } else if (typeof callback === 'function') {
              callback();
            }
            return true;
          }
          // Pass through other messages
          return originalStderrWrite.call(this, chunk, encoding, callback);
        };
      }

      // Import @xenova/transformers for pure JavaScript Whisper
      // Use require for better CommonJS compatibility in compiled code
      const transformers = require('@xenova/transformers');
      const { pipeline } = transformers;
      
      // Create the transcription pipeline with the specified model
      // Use multilingual models (without .en) as they're more accessible
      const modelMap: Record<WhisperModel, string> = {
        'tiny': 'Xenova/whisper-tiny',
        'base': 'Xenova/whisper-base', 
        'small': 'Xenova/whisper-small',
        'medium': 'Xenova/whisper-medium',
        'large': 'Xenova/whisper-medium' // Fallback to medium for large due to access restrictions
      };
      
      const modelName = modelMap[model] || 'Xenova/whisper-base';
      logger.debug(`Loading Whisper model: ${modelName} (mapped from ${model})`);
      this.nodeWhisper = await pipeline('automatic-speech-recognition', modelName, {
        // Set cache directory for model files
        cache_dir: this.cacheDir
      });
      
      logger.debug(`@xenova/transformers whisper pipeline loaded successfully: ${modelName}`);
      
      // Restore original stderr write function if we modified it
      if (shouldSuppressWarnings) {
        process.stderr.write = originalStderrWrite;
      }
    } catch (error) {
      // Restore original stderr write function on error too
      if (shouldSuppressWarnings) {
        process.stderr.write = originalStderrWrite;
      }
      
      logger.error('Failed to load @xenova/transformers:', error);
      throw new Error(
        `Failed to load Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async ensureModelAvailable(
    model: WhisperModel,
    onProgress?: (progress: WhisperProgress) => void
  ): Promise<void> {
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

    // Model needs to be downloaded
    await this.downloadModelFromSource(model, onProgress);
  }

  private async downloadModelFromSource(
    model: WhisperModel,
    onProgress?: (progress: WhisperProgress) => void
  ): Promise<void> {
    const modelInfo = MODEL_SIZES[model];
    
    if (onProgress) {
      onProgress({
        type: 'download',
        progress: 0,
        message: `⬬ Downloading ${model} model (${modelInfo.size})...`
      });
    }

    try {
      // whisper-node downloads models automatically on first use
      // We'll mark it as "downloaded" after loading the module successfully
      await this.loadNodeWhisper(model);
      
      logger.info(`Whisper model ${model} will be downloaded automatically on first use`);
      
      // Create a marker file to indicate the model is "available"
      const modelPath = this.getModelPath(model);
      await fs.promises.writeFile(modelPath, `whisper-${model}-model-marker`);
      
      if (onProgress) {
        onProgress({
          type: 'download',
          progress: 100,
          message: `✅ Model ${model} prepared (${modelInfo.size})`
        });
      }

      logger.info(`Whisper model ${model} ready for use`);
    } catch (error) {
      logger.error(`Failed to prepare Whisper model ${model}:`, error);
      throw new Error(`Failed to prepare ${model} model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isModelCached(model: WhisperModel): boolean {
    const modelPath = this.getModelPath(model);
    return fs.existsSync(modelPath);
  }

  private getModelPath(model: WhisperModel): string {
    return path.join(this.cacheDir, `${model}.pt`);
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      logger.debug(`Created Whisper cache directory: ${this.cacheDir}`);
    }
  }

  private parseWhisperResult(result: any, processingTime: number): WhisperResult {
    // Parse result from @xenova/transformers format
    // Xenova returns: { text: string, chunks?: [{text, timestamp}] }
    const fullText = result.text || '';
    
    // Extract segments from chunks if available
    let segments = [];
    if (result.chunks && Array.isArray(result.chunks)) {
      segments = result.chunks.map((chunk: any) => ({
        start: chunk.timestamp?.[0] || 0,
        end: chunk.timestamp?.[1] || 0,
        text: chunk.text || ''
      }));
    } else {
      // If no chunks, create a single segment for the full text
      segments = [{
        start: 0,
        end: 0, // We don't know duration without chunks
        text: fullText
      }];
    }
    
    // Calculate duration from last segment or estimate
    const duration = segments.length > 0 && segments[segments.length - 1].end > 0 
      ? segments[segments.length - 1].end 
      : Math.max(fullText.length * 0.1, 1); // Rough estimate: 0.1s per character
    
    return {
      text: fullText,
      segments: segments,
      language: 'auto-detected', // Xenova doesn't return language detection
      duration: duration * 1000, // Convert to milliseconds
      processingTime
    };
  }

  /**
   * Get audio duration using ffprobe
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const ffprobeStatic = require('ffprobe-static') as { path: string };
      const { execSync } = await import('child_process');
      
      const command = `"${ffprobeStatic.path}" -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
      const output = execSync(command, { encoding: 'utf8' }).toString().trim();
      return parseFloat(output) || 0;
    } catch (error) {
      logger.warn('Failed to get audio duration, using estimation:', error);
      return 0; // Fallback to no duration info
    }
  }

  private async processAudioForNode(audioPath: string): Promise<Float32Array> {
    // @xenova/transformers requires Float32Array with specific format:
    // - 16kHz sample rate
    // - Single channel (mono)
    // - 32-bit float PCM
    
    try {
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      // Create temporary raw audio file
      const tempRawFile = path.join(os.tmpdir(), `whisper-raw-${Date.now()}.raw`);
      
      // Use ffmpeg-static for cross-platform binary access
      const ffmpegStatic = await import('ffmpeg-static');
      const ffmpegPath = ffmpegStatic.default;
      
      if (!ffmpegPath) {
        throw new Error('FFmpeg binary not found. Please install ffmpeg-static.');
      }
      
      // Use FFmpeg to convert to raw 32-bit float, 16kHz, mono
      const ffmpegCmd = `"${ffmpegPath}" -i "${audioPath}" -ar 16000 -ac 1 -f f32le -acodec pcm_f32le "${tempRawFile}" -y`;
      
      logger.debug(`Converting audio for Whisper: ${ffmpegCmd}`);
      execSync(ffmpegCmd, { stdio: 'pipe' });
      
      // Read the raw audio data
      const rawBuffer = fs.readFileSync(tempRawFile);
      
      // Convert Buffer to Float32Array
      const audioData = new Float32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);
      
      // Clean up temporary file
      fs.unlinkSync(tempRawFile);
      
      logger.debug(`Processed audio: ${audioData.length} samples at 16kHz`);
      return audioData;
      
    } catch (error) {
      logger.error('Failed to process audio for Whisper:', error);
      throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleWhisperError(error: any, options: WhisperOptions): Error {
    const message = error instanceof Error ? error.message : 'Unknown Whisper error';
    
    // Provide smart error messages with suggestions
    if (message.includes('memory') || message.includes('OOM')) {
      const currentModel = this.resolveModel(options);
      const suggestions = this.getSmallerModelSuggestions(currentModel);
      
      return new Error(
        `❌ Out of memory error with '${currentModel}' model.\n` +
        `💡 Try a smaller model: ${suggestions.join(' or ')}\n` +
        `💡 Or use cloud transcription by removing --local-whisper flag`
      );
    }
    
    if (message.includes('network') || message.includes('download')) {
      return new Error(
        `❌ Network error during model download.\n` +
        `💡 Check your internet connection and try again\n` +
        `💡 Or use cloud transcription by removing --local-whisper flag`
      );
    }
    
    if (message.includes('not found') || message.includes('ENOENT')) {
      return new Error(
        `❌ Model file not found or corrupted.\n` +
        `💡 Try clearing cache and re-downloading: --whisper-clear-cache\n` +
        `💡 Or use cloud transcription by removing --local-whisper flag`
      );
    }
    
    return new Error(`Whisper transcription failed: ${message}`);
  }

  private getSmallerModelSuggestions(currentModel: WhisperModel): string[] {
    const modelOrder: WhisperModel[] = ['tiny', 'base', 'small', 'medium', 'large'];
    const currentIndex = modelOrder.indexOf(currentModel);
    
    if (currentIndex <= 0) return ['base'];
    
    return modelOrder.slice(0, currentIndex);
  }
}
