/**
 * WorkflowExecutor
 * Handles the step-by-step execution of video transcription workflows
 */

import { ServiceManager, ProgressAggregator, ProgressReporters } from '@video-transcribe/core';
import { WorkflowContext, CLIStepResult } from '../types';
import fs from 'fs';

export class WorkflowExecutor {
  private serviceManager: ServiceManager;
  private progressAggregator: ProgressAggregator;

  constructor(context: WorkflowContext) {
    this.serviceManager = ServiceManager.getInstance();
    
    // Setup progress reporting for the entire workflow
    const progressReporter = ProgressReporters.console(context.options.verbose);
    this.progressAggregator = new ProgressAggregator(progressReporter);
    
    // Define workflow steps with weights
    this.progressAggregator.defineSteps({
      extraction: 0.3,   // 30% of total progress
      transcription: 0.6, // 60% of total progress  
      enhancement: 0.1   // 10% of total progress
    });
  }

  /**
   * Execute the complete workflow from video upload through final output
   */
  async executeWorkflow(context: WorkflowContext): Promise<void> {
    // === STEP 2: UPLOAD/STORE VIDEO ===
    await this.executeVideoUpload(context);

    // === STEP 3: EXTRACT AUDIO ===
    await this.executeAudioExtraction(context);

    // === STEP 4: TRANSCRIBE AUDIO ===
    await this.executeTranscription(context);

    // === STEP 5: ENHANCE TRANSCRIPTION ===
    await this.executeEnhancement(context);
  }

  /**
   * Step 2: Video Upload/Storage
   */
  async executeVideoUpload(context: WorkflowContext): Promise<CLIStepResult> {
    const { workflowId, inputSource, options, isUrl } = context;
    const stateStore = this.serviceManager.getAgentStateStore();
    const referenceService = this.serviceManager.getReferenceService();

    const stepStart = Date.now();
    console.log('\n📤 STEP 2/5: Processing Video Source');
    
    if (options.verbose && isUrl) {
      console.log(`🌐 Downloading from: ${inputSource}`);
    } else if (options.verbose) {
      console.log(`📁 Loading from: ${inputSource}`);
    }

    await stateStore.startStep(workflowId, 'upload_video');

    try {
      let videoUrl: string;

      if (isUrl) {
        // Download and store remote video
        videoUrl = await referenceService.storeFromUrlWithProgress(
          inputSource,
          workflowId,
          (downloaded, total, percentage) => {
            if (options.verbose && percentage % 10 === 0) {
              console.log(`📥 Downloaded: ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB (${percentage}%)`);
            }
          }
        );
      } else {
        // Store local file
        videoUrl = await referenceService.storeFromPath(inputSource, workflowId);
      }

      // Get file info for size
      const fileInfo = await referenceService.getFileInfo(videoUrl);
      const sizeInMB = fileInfo?.size ? fileInfo.size / (1024 * 1024) : 0;

      await stateStore.completeStep(workflowId, 'upload_video', {
        video_url: videoUrl,
        upload_time: Date.now() - stepStart,
        size_mb: sizeInMB
      });

      const processingTime = Date.now() - stepStart;
      console.log(`✅ Video processed: ${sizeInMB.toFixed(1)}MB (${processingTime}ms)`);

      // Store results in context for next steps
      (context as any).videoUrl = videoUrl;
      (context as any).sizeInMB = sizeInMB;

      return {
        stepName: 'upload_video',
        success: true,
        processingTime,
        stateResult: { video_url: videoUrl, upload_time: processingTime, size_mb: sizeInMB }
      };
    } catch (error) {
      const processingTime = Date.now() - stepStart;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await stateStore.failStep(workflowId, 'upload_video', { message: errorMessage });
      console.error(`❌ Video processing failed: ${errorMessage}`);
      
      return {
        stepName: 'upload_video',
        success: false,
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Step 3: Audio Extraction
   */
  async executeAudioExtraction(context: WorkflowContext): Promise<CLIStepResult> {
    const { workflowId, options } = context;
    const videoUrl = (context as any).videoUrl;
    const sizeInMB = (context as any).sizeInMB;
    
    const stateStore = this.serviceManager.getAgentStateStore();
    const referenceService = this.serviceManager.getReferenceService();

    console.log('\n🎵 STEP 3/5: Extracting Audio');
    console.log('DEBUG: Step 3 header printed'); // Debug line
    if (options.verbose) {
      console.log(`🔧 Converting ${sizeInMB}MB video to WAV audio...`);
      console.log(`⚙️  Using FFmpeg for audio extraction...`);
    }

    const audioStart = Date.now();
    await stateStore.startStep(workflowId, 'extract_audio');

    try {
      // Use AudioExtractorService via ServiceManager
      const audioExtractor = this.serviceManager.getAudioExtractorService();
      
      const videoFilePath = referenceService.getFilePathFromUrl(videoUrl);
      const audioResult = await audioExtractor.extractAudioFromMp4(
        videoFilePath,
        this.progressAggregator.createStepCallback('extraction')
      );
      
      // Store audio as reference
      const audioBuffer = await fs.promises.readFile(audioResult.audioFilePath);
      const audioUrl = await referenceService.storeAudio(audioBuffer, workflowId);
      
      await stateStore.completeStep(workflowId, 'extract_audio', {
        audio_url: audioUrl,
        extraction_time: Date.now() - audioStart,
        video_cleaned: !options.keepAudio, // Clean video unless keeping audio
        audio_size: audioBuffer.length
      });

      const processingTime = Date.now() - audioStart;
      const audioSizeInMB = audioBuffer.length / (1024 * 1024);
      console.log(`✅ Audio extracted: ${audioSizeInMB.toFixed(1)}MB WAV (${processingTime}ms)`);

      // Store results in context for next steps
      (context as any).audioUrl = audioUrl;
      (context as any).audioSizeInMB = audioSizeInMB;
      (context as any).audioFilePath = audioResult.audioFilePath;

      return {
        stepName: 'extract_audio',
        success: true,
        processingTime,
        stateResult: {
          audio_url: audioUrl,
          extraction_time: processingTime,
          video_cleaned: !options.keepAudio,
          audio_size: audioBuffer.length
        }
      };
    } catch (error) {
      const processingTime = Date.now() - audioStart;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await stateStore.failStep(workflowId, 'extract_audio', { message: errorMessage });
      console.error(`❌ Audio extraction failed: ${errorMessage}`);
      
      return {
        stepName: 'extract_audio',
        success: false,
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Step 4: Audio Transcription
   */
  async executeTranscription(context: WorkflowContext): Promise<CLIStepResult> {
    const { workflowId, options } = context;
    // const audioUrl = (context as any).audioUrl;
    const audioSizeInMB = (context as any).audioSizeInMB;
    const audioFilePath = (context as any).audioFilePath;
    
    const stateStore = this.serviceManager.getAgentStateStore();

    console.log('\n🎤 STEP 4/5: Transcribing Speech to Text');
    if (options.verbose) {
      console.log(`🤖 Processing ${audioSizeInMB.toFixed(1)}MB audio with local Whisper...`);
    }

    const transcribeStart = Date.now();
    await stateStore.startStep(workflowId, 'transcribe_audio');

    try {
      let transcriptionResult;

      if (!options.useAzure) {
        // Use local Whisper transcription
        const whisperService = this.serviceManager.getWhisperService();
        
        const whisperOptions = {
          model: options.whisperModel as any,
          quality: options.whisperQuality as any,
          language: options.language,
          cacheDir: options.whisperCacheDir,
          verbose: options.verbose
        };
        
        const whisperResult = await whisperService.transcribeAudio(
          audioFilePath, 
          whisperOptions,
          this.progressAggregator.createStepCallback('transcription')
        );
        
        // Convert Whisper result to expected format
        transcriptionResult = {
          success: true,
          rawText: whisperResult.text,
          segments: whisperResult.segments || [],
          duration: whisperResult.duration || 0,
          language: whisperResult.language || 'auto-detected',
          confidence: null // Whisper doesn't provide confidence scores
        };
      } else {
        // Use Azure Speech Services
        const transcribeService = this.serviceManager.getTranscribeAudioService();
        const result = await transcribeService.transcribeAudio({
          audioId: workflowId,
          audioFilePath: audioFilePath
        });
        transcriptionResult = result;
      }

      await stateStore.completeStep(workflowId, 'transcribe_audio', {
        raw_text: transcriptionResult.rawText,
        segments: transcriptionResult.segments,
        duration: transcriptionResult.duration,
        language: transcriptionResult.language,
        confidence: transcriptionResult.confidence,
        transcription_time: Date.now() - transcribeStart,
        service_used: options.useAzure ? 'azure' : 'whisper'
      });

      const processingTime = Date.now() - transcribeStart;
      const confidenceText = transcriptionResult.confidence 
        ? `${Math.round(transcriptionResult.confidence * 100)}%` 
        : 'N/A%';
      
      console.log(`✅ Transcription completed: ${options.useAzure ? 'Azure Speech' : 'Local Whisper'} (Confidence: ${confidenceText})`);

      // Store transcription result in context
      (context as any).transcriptionResult = transcriptionResult;

      return {
        stepName: 'transcribe_audio',
        success: true,
        processingTime,
        stateResult: {
          raw_text: transcriptionResult.rawText,
          segments: transcriptionResult.segments,
          duration: transcriptionResult.duration,
          language: transcriptionResult.language,
          confidence: transcriptionResult.confidence,
          transcription_time: processingTime,
          service_used: options.useAzure ? 'azure' : 'whisper'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - transcribeStart;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await stateStore.failStep(workflowId, 'transcribe_audio', { message: errorMessage });
      console.error(`❌ Transcription failed: ${errorMessage}`);
      
      return {
        stepName: 'transcribe_audio',
        success: false,
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Step 5: AI Enhancement
   */
  async executeEnhancement(context: WorkflowContext): Promise<CLIStepResult> {
    const { workflowId, options } = context;
    const transcriptionResult = (context as any).transcriptionResult;
    
    const stateStore = this.serviceManager.getAgentStateStore();

    // Skip enhancement if fully local or enhancement disabled
    if (options.fullyLocal) {
      console.log('\n🏠 STEP 5/5: Skipping Enhancement (fully local mode)');
      (context as any).enhancedResult = null;
      return {
        stepName: 'enhance_transcription',
        success: true,
        processingTime: 0
      };
    }

    if (!options.enhance) {
      console.log('\n⏭️  STEP 5/5: Skipping GPT Enhancement (use --enhance to enable)');
      (context as any).enhancedResult = null;
      return {
        stepName: 'enhance_transcription',
        success: true,
        processingTime: 0
      };
    }

    console.log('\n🎯 STEP 5/5: Enhancing Transcription with AI');
    if (options.verbose) {
      console.log('⚡ Generating summary, key points, topics, and sentiment...');
    }

    const enhanceStart = Date.now();
    await stateStore.startStep(workflowId, 'enhance_transcription');

    try {
      const enhanceService = this.serviceManager.getGPTEnhancementService();
      
      const enhancedResult = await enhanceService.enhanceTranscription({
        fullText: transcriptionResult.rawText!,
        segments: transcriptionResult.segments || [],
        duration: transcriptionResult.duration || 0,
        language: transcriptionResult.language || 'en-US',
        confidence: transcriptionResult.confidence || 0
      });

      await stateStore.completeStep(workflowId, 'enhance_transcription', {
        enhanced_text: enhancedResult.enhancedText,
        summary: enhancedResult.summary,
        key_points: enhancedResult.keyPoints,
        topics: enhancedResult.topics,
        sentiment: enhancedResult.sentiment,
        enhancement_time: Date.now() - enhanceStart,
        model_used: 'gpt-4'
      });

      const processingTime = Date.now() - enhanceStart;
      console.log(`✅ Text enhanced: GPT-4 improved formatting and structure (${processingTime}ms)`);

      // Store enhanced result in context
      (context as any).enhancedResult = enhancedResult;

      return {
        stepName: 'enhance_transcription',
        success: true,
        processingTime,
        stateResult: {
          enhanced_text: enhancedResult.enhancedText,
          summary: enhancedResult.summary,
          key_points: enhancedResult.keyPoints,
          topics: enhancedResult.topics,
          sentiment: enhancedResult.sentiment,
          enhancement_time: processingTime,
          model_used: 'gpt-4'
        }
      };
    } catch (error) {
      const processingTime = Date.now() - enhanceStart;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await stateStore.failStep(workflowId, 'enhance_transcription', { message: errorMessage });
      console.error(`❌ Enhancement failed: ${errorMessage}`);
      
      return {
        stepName: 'enhance_transcription',
        success: false,
        processingTime,
        error: errorMessage
      };
    }
  }
}
