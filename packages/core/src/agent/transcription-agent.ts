#!/usr/bin/env node
/**
 * TranscriptionAgent - Unified agent class for video transcription
 * 
 * Combines both the README API (processVideo) and framework API (transcribeVideo)
 * into a single class that supports both usage patterns.
 */

import { logger } from '../utils/logger';
import { ServiceManager } from '../services/service-manager';
import { promises as fs } from 'fs';

// Type definitions
interface TranscriptionSegment {
  text: string;
  start?: number;
  end?: number;
  confidence?: number;
}

// Sentiment can be either a simple string or detailed analysis
type SentimentAnalysis = 'positive' | 'neutral' | 'negative' | {
  overall: string;
  confidence: number;
  scores?: {
    positive: number;
    negative: number;
    neutral: number;
  };
};

// README-style interface (processVideo)
export interface ProcessVideoOptions {
  inputFile?: string;
  videoPath?: string;
  videoUrl?: string;
  sourceUrl?: string;
  outputDir?: string;
  enhanceWithGPT?: boolean;
  enhance?: boolean;
  format?: 'json' | 'txt' | 'both';
  keepAudioFile?: boolean;
}

export interface ProcessVideoResult {
  success: boolean;
  error?: string;
  workflow_id?: string;
  transcription?: {
    fullText: string;
    segments?: TranscriptionSegment[];
    confidence?: number;
    language?: string;
  };
  enhancement?: {
    enhancedText: string;
    summary?: string;
    keyPoints?: string[];
    topics?: string[];
    sentiment?: SentimentAnalysis;
  };
  processing_time?: number;
  outputFiles?: string[];
}

// Framework-style interface (transcribeVideo)
export interface TranscribeVideoOptions {
  videoPath?: string;
  videoUrl?: string;
  sourceUrl?: string;
  enhance?: boolean;
  outputFormat?: 'json' | 'txt' | 'both';
  keepAudioFile?: boolean;
}

export interface TranscribeVideoResult {
  success: boolean;
  error?: string;
  workflow_id?: string;
  transcription?: string;
  rawTranscription?: string;
  summary?: string;
  keyPoints?: string[];
  topics?: string[];
  sentiment?: SentimentAnalysis;
  outputFiles?: string[];
  processing_time?: number;
  segments?: TranscriptionSegment[];
  confidence?: number;
  language?: string;
}

// Health check and tool interfaces
export interface HealthCheckResult {
  healthy: boolean;
  capabilities: string[];
  services: Record<string, boolean>;
}

export interface ToolDescription {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required: string[];
  };
}

/**
 * Unified TranscriptionAgent class
 * Supports both README API and framework API
 */
export class TranscriptionAgent {
  private stateStore = ServiceManager.getInstance().getAgentStateStore();
  private referenceService = ServiceManager.getInstance().getReferenceService();
  private serviceManager = ServiceManager.getInstance();

  /**
   * README-style API: Process video with the exact interface shown in documentation
   */
  async processVideo(options: ProcessVideoOptions): Promise<ProcessVideoResult> {
    try {
      logger.info('TranscriptionAgent.processVideo: Starting video processing', { options });

      // Map README options to internal options
      const internalOptions: TranscribeVideoOptions = {
        videoPath: options.inputFile || options.videoPath,
        videoUrl: options.videoUrl,
        sourceUrl: options.sourceUrl,
        enhance: options.enhanceWithGPT ?? options.enhance ?? false,
        outputFormat: options.format || 'json',
        keepAudioFile: options.keepAudioFile || false
      };

      // Use the internal transcription method
      const result = await this.transcribeVideo(internalOptions);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          workflow_id: result.workflow_id
        };
      }

      // Map internal result to README-style result
      return {
        success: true,
        workflow_id: result.workflow_id,
        transcription: {
          fullText: result.transcription || result.rawTranscription || '',
          segments: result.segments,
          confidence: result.confidence,
          language: result.language
        },
        enhancement: result.summary || result.keyPoints || result.topics || result.sentiment ? {
          enhancedText: result.transcription || '',
          summary: result.summary,
          keyPoints: result.keyPoints,
          topics: result.topics,
          sentiment: result.sentiment
        } : undefined,
        processing_time: result.processing_time,
        outputFiles: result.outputFiles
      };

    } catch (error) {
      logger.error('TranscriptionAgent.processVideo: Error processing video', { error, options });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Framework-style API: Main transcription method for AI agent integration
   */
  async transcribeVideo(options: TranscribeVideoOptions): Promise<TranscribeVideoResult> {
    const startTime = Date.now();
    let workflow_id: string | undefined;

    try {
      logger.info('TranscriptionAgent.transcribeVideo: Starting video transcription', { options });

      // Validate inputs
      const sourceUrl = options.sourceUrl || options.videoUrl || options.videoPath;
      if (!sourceUrl) {
        return {
          success: false,
          error: 'One of videoPath, videoUrl, or sourceUrl is required'
        };
      }

      // Step 1: Create workflow and upload video
      workflow_id = await this.stateStore.createWorkflow();
      await this.stateStore.startStep(workflow_id, 'upload_video');

      // Determine if URL or local file and use appropriate method
      let video_url: string;
      try {
        new URL(sourceUrl);
        // It's a URL
        video_url = await this.referenceService.storeFromUrl(sourceUrl, workflow_id);
      } catch {
        // It's a local file path
        video_url = await this.referenceService.storeFromPath(sourceUrl, workflow_id);
      }

      const fileInfo = await this.referenceService.getFileInfo(video_url);

      await this.stateStore.completeStep(workflow_id, 'upload_video', {
        video_url,
        size: fileInfo?.size || 0,
        format: sourceUrl.split('.').pop()?.toLowerCase() || 'mp4',
        source_url: sourceUrl
      });

      // Step 2: Extract audio
      await this.stateStore.startStep(workflow_id, 'extract_audio');
      
      const videoFilePath = this.referenceService.getFilePathFromUrl(video_url);
      const audioExtractor = this.serviceManager.getAudioExtractorService();
      const audioResult = await audioExtractor.extractAudioFromMp4(videoFilePath);

      // Store the audio file as a reference
      const audioBuffer = await fs.readFile(audioResult.audioFilePath);
      const audio_url = await this.referenceService.storeAudio(audioBuffer, workflow_id);

      await this.stateStore.completeStep(workflow_id, 'extract_audio', {
        audio_url,
        extraction_time: 0,
        video_cleaned: !options.keepAudioFile,
        audio_size: audioBuffer.length
      });

      // Step 3: Transcribe audio
      await this.stateStore.startStep(workflow_id, 'transcribe_audio');
      
      const transcribeService = this.serviceManager.getTranscribeAudioService();
      const audioFilePath = this.referenceService.getFilePathFromUrl(audio_url);
      
      const transcriptionResult = await transcribeService.transcribeAudio({
        audioId: workflow_id,
        audioFilePath: audioFilePath
      });

      if (!transcriptionResult.success) {
        throw new Error(`Transcription failed: ${transcriptionResult.error}`);
      }

      await this.stateStore.completeStep(workflow_id, 'transcribe_audio', {
        raw_text: transcriptionResult.rawText,
        confidence: transcriptionResult.confidence,
        language: transcriptionResult.language,
        segments: transcriptionResult.segments,
        duration: transcriptionResult.duration,
        transcription_time: transcriptionResult.transcriptionTime,
        audio_cleaned: true
      });

      let enhancedText: string | undefined;
      let summary: string | undefined;
      let keyPoints: string[] | undefined;
      let topics: string[] | undefined;
      let sentiment: SentimentAnalysis | undefined;

      // Step 4: Optional enhancement
      if (options.enhance) {
        await this.stateStore.startStep(workflow_id, 'enhance_transcription');
        
        const enhanceService = this.serviceManager.getGPTEnhancementService();
        const enhancementResult = await enhanceService.enhanceTranscription({
          fullText: transcriptionResult.rawText!,
          segments: transcriptionResult.segments || [],
          duration: transcriptionResult.duration || 0,
          language: transcriptionResult.language || 'en-US',
          confidence: transcriptionResult.confidence || 0
        });

        enhancedText = enhancementResult.enhancedText;
        summary = enhancementResult.summary;
        keyPoints = enhancementResult.keyPoints;
        topics = enhancementResult.topics;
        sentiment = enhancementResult.sentiment;

        await this.stateStore.completeStep(workflow_id, 'enhance_transcription', {
          enhanced_text: enhancedText,
          summary,
          key_points: keyPoints,
          topics,
          sentiment,
          enhancement_time: 0
        });
      }

      const processing_time = Date.now() - startTime;

      return {
        success: true,
        workflow_id,
        transcription: enhancedText || transcriptionResult.rawText,
        rawTranscription: transcriptionResult.rawText,
        summary,
        keyPoints,
        topics,
        sentiment,
        segments: transcriptionResult.segments,
        confidence: transcriptionResult.confidence,
        language: transcriptionResult.language,
        processing_time,
        outputFiles: [] // TODO: Handle output file generation if needed
      };

    } catch (error) {
      logger.error('TranscriptionAgent.transcribeVideo: Error during transcription', { error, options, workflow_id });
      
      // Workflow state is preserved for debugging

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        workflow_id
      };
    }
  }

  /**
   * Check if the transcription services are healthy
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      logger.info('TranscriptionAgent: Starting health check');

      // Test Azure connection
      const azureClient = this.serviceManager.getAzureClientService();
      await azureClient.testConnection();

      return {
        healthy: true,
        capabilities: [
          'video_upload',
          'audio_extraction', 
          'speech_to_text',
          'gpt_enhancement',
          'summary_generation',
          'key_points_extraction',
          'sentiment_analysis',
          'topic_identification'
        ],
        services: {
          azure: true,
          audioExtractor: true,
          transcription: true,
          gptEnhancement: true
        }
      };

    } catch (error) {
      logger.error('TranscriptionAgent: Health check failed', { error });
      return {
        healthy: false,
        capabilities: [],
        services: {
          azure: false,
          audioExtractor: false,
          transcription: false,
          gptEnhancement: false
        }
      };
    }
  }

  /**
   * Check if the agent is healthy (alias for healthCheck)
   */
  async isHealthy(): Promise<boolean> {
    const health = await this.healthCheck();
    return health.healthy;
  }

  /**
   * Get agent capabilities
   */
  async getCapabilities(): Promise<string[]> {
    const health = await this.healthCheck();
    return health.capabilities;
  }

  /**
   * Get tool schema for LangChain/framework integration
   */
  getToolDescription(): ToolDescription {
    return {
      name: 'transcribe_video',
      description: `Transcribe MP4 video files to text with optional AI enhancement.
        Supports both local file paths and remote URLs.
        Returns transcribed text, summary, key points, topics, and sentiment analysis.`,
      parameters: {
        type: 'object',
        properties: {
          videoPath: {
            type: 'string',
            description: 'Local path to MP4 video file'
          },
          videoUrl: {
            type: 'string', 
            description: 'Remote URL to MP4 video file'
          },
          sourceUrl: {
            type: 'string',
            description: 'Local path or remote URL to MP4 video file'
          },
          enhance: {
            type: 'boolean',
            description: 'Whether to enhance transcription using GPT models',
            default: false
          },
          outputFormat: {
            type: 'string',
            enum: ['json', 'txt', 'both'],
            description: 'Output format for results',
            default: 'json'
          },
          keepAudioFile: {
            type: 'boolean',
            description: 'Whether to keep extracted audio file',
            default: false
          }
        },
        required: [] // One of the video source options is required
      }
    };
  }

  /**
   * Get tool schema (alias for getToolDescription)
   */
  getToolSchema(): ToolDescription {
    return this.getToolDescription();
  }
}
