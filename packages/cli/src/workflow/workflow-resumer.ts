/**
 * WorkflowResumer
 * Handles resuming workflows from specific steps with original options
 */

import { ServiceManager } from '@video-transcribe/core';
import { ResumeContext, ResumeOptions, WorkflowSteps } from '../types';

export class WorkflowResumer {
  private serviceManager: ServiceManager;

  constructor() {
    this.serviceManager = ServiceManager.getInstance();
  }

  /**
   * Execute resume workflow from the appropriate step
   */
  async executeResume(context: ResumeContext, _options: ResumeOptions): Promise<void> {
    const { workflowId, originalInput, resumeFromStep } = context;
    // Note: originalOptions is accessed via context in individual resume methods

    if (resumeFromStep === 'completed') {
      console.log('\n🎉 Workflow already completed! Showing results...');
      return;
    }

    console.log(`\n🔄 Resuming workflow: ${workflowId}`);
    console.log(`📂 Original input: ${originalInput}`);
    console.log(`⚙️  Using original options from when workflow was created`);

    // Resume from the appropriate step using original options
    if (resumeFromStep === 'upload_video') {
      await this.resumeVideoUpload(context);
      // Continue to next steps
      await this.resumeAudioExtraction(context);
      await this.resumeTranscription(context);
      const forceEnhance = false;
      await this.resumeEnhancement(context, forceEnhance);
    }

    if (resumeFromStep === 'extract_audio') {
      await this.resumeAudioExtraction(context);
      // Update audio URL after extraction
      const updatedState = await this.serviceManager.getAgentStateStore().getState(workflowId);
      if (updatedState) {
        context.existingState = updatedState;
      }
      await this.resumeTranscription(context);
      const forceEnhance = false;
      await this.resumeEnhancement(context, forceEnhance);
    }

    if (resumeFromStep === 'transcribe_audio') {
      await this.resumeTranscription(context);
      const forceEnhance = false;
      await this.resumeEnhancement(context, forceEnhance);
    }

    if (resumeFromStep === 'enhance_transcription') {
      const forceEnhance = true;
      await this.resumeEnhancement(context, forceEnhance);
    }
  }

  /**
   * Resume from video upload step
   */
  private async resumeVideoUpload(context: ResumeContext): Promise<void> {
    const { workflowId, originalInput, originalOptions } = context;
    const serviceManager = this.serviceManager;
    const stateStore = serviceManager.getAgentStateStore();
    const referenceService = serviceManager.getReferenceService();

    console.log('\n📤 STEP 2/5: Re-processing Video Source');
    console.log('🔄 Re-running video upload step');

    await stateStore.startStep(workflowId, 'upload_video');

    try {
      const isUrl = originalInput.startsWith('http://') || originalInput.startsWith('https://');
      let videoUrl: string;

      if (isUrl) {
        videoUrl = await referenceService.storeFromUrlWithProgress(
          originalInput,
          workflowId,
          (downloaded: number, total: number, percentage: number) => {
            if (originalOptions.verbose && percentage % 10 === 0) {
              console.log(`📥 Downloaded: ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB (${percentage}%)`);
            }
          }
        );
      } else {
        videoUrl = await referenceService.storeFromPath(originalInput, workflowId);
      }

      // Get file info for size
      const fileInfo = await referenceService.getFileInfo(videoUrl);
      const sizeInMB = fileInfo?.size ? fileInfo.size / (1024 * 1024) : 0;

      await stateStore.completeStep(workflowId, 'upload_video', {
        video_url: videoUrl,
        upload_time: 0,
        size_mb: sizeInMB
      });

      console.log(`✅ Video re-processed: ${sizeInMB.toFixed(1)}MB`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await stateStore.failStep(workflowId, 'upload_video', { message: errorMessage });
      throw error;
    }
  }

  /**
   * Resume from audio extraction step
   */
  private async resumeAudioExtraction(context: ResumeContext): Promise<void> {
    const { workflowId, existingState, originalOptions } = context;
    const serviceManager = this.serviceManager;
    const stateStore = serviceManager.getAgentStateStore();
    const referenceService = serviceManager.getReferenceService();

    console.log('\n🎵 STEP 3/5: Re-extracting Audio');
    console.log('🔄 Re-running audio extraction step');

    const steps = existingState.steps || {};
    const videoUrl = steps.upload_video?.result?.video_url;
    
    if (!videoUrl) {
      throw new Error('Video URL not found in workflow state. Cannot resume audio extraction.');
    }

    await stateStore.startStep(workflowId, 'extract_audio');

    try {
      const audioExtractor = serviceManager.getAudioExtractorService();
      const videoFilePath = referenceService.getFilePathFromUrl(videoUrl);
      const audioResult = await audioExtractor.extractAudioFromMp4(videoFilePath);
      
      // Store audio as reference
      const audioBuffer = await require('fs').promises.readFile(audioResult.audioFilePath);
      const audioUrl = await referenceService.storeAudio(audioBuffer, workflowId);
      
      await stateStore.completeStep(workflowId, 'extract_audio', {
        audio_url: audioUrl,
        extraction_time: 0,
        video_cleaned: !originalOptions.keepAudio,
        audio_size: audioBuffer.length
      });

      const audioSizeInMB = audioBuffer.length / (1024 * 1024);
      console.log(`✅ Audio re-extracted: ${audioSizeInMB.toFixed(1)}MB WAV`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await stateStore.failStep(workflowId, 'extract_audio', { message: errorMessage });
      throw error;
    }
  }

  /**
   * Resume from transcription step
   */
  private async resumeTranscription(context: ResumeContext): Promise<void> {
    const { workflowId, existingState, originalOptions } = context;
    const serviceManager = this.serviceManager;
    const stateStore = serviceManager.getAgentStateStore();
    const referenceService = serviceManager.getReferenceService();

    console.log('\n🎤 STEP 4/5: Re-running Transcription');
    console.log('🔄 Re-running speech-to-text conversion');

    const steps = existingState.steps || {};
    const audioUrl = steps.extract_audio?.result?.audio_url;
    
    if (!audioUrl) {
      throw new Error('Audio URL not found in workflow state. Cannot resume transcription.');
    }

    await stateStore.startStep(workflowId, 'transcribe_audio');

    try {
      const audioFilePath = referenceService.getFilePathFromUrl(audioUrl);
      let transcriptionResult;

      if (!originalOptions.useAzure) {
        // Use local Whisper transcription
        const whisperService = serviceManager.getWhisperService();
        
        const whisperOptions = {
          model: originalOptions.whisperModel as any,
          quality: originalOptions.whisperQuality as any,
          language: originalOptions.language,
          cacheDir: originalOptions.whisperCacheDir,
          verbose: originalOptions.verbose
        };
        
        const whisperResult = await whisperService.transcribeAudio(audioFilePath, whisperOptions);
        
        // Convert Whisper result to expected format
        transcriptionResult = {
          success: true,
          rawText: whisperResult.text,
          segments: whisperResult.segments || [],
          duration: whisperResult.duration || 0,
          language: whisperResult.language || 'auto-detected',
          confidence: null
        };
      } else {
        // Use Azure Speech Services
        const transcribeService = serviceManager.getTranscribeAudioService();
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
        transcription_time: 0,
        service_used: originalOptions.useAzure ? 'azure' : 'whisper'
      });

      const confidenceText = transcriptionResult.confidence 
        ? `${Math.round(transcriptionResult.confidence * 100)}%` 
        : 'N/A%';
      
      console.log(`✅ Transcription re-completed: ${originalOptions.useAzure ? 'Azure Speech' : 'Local Whisper'} (Confidence: ${confidenceText})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await stateStore.failStep(workflowId, 'transcribe_audio', { message: errorMessage });
      throw error;
    }
  }

  /**
   * Resume from enhancement step
   */
  private async resumeEnhancement(context: ResumeContext, forceEnhance = false): Promise<void> {
    const { workflowId, existingState, originalOptions } = context;
    const serviceManager = this.serviceManager;
    const stateStore = serviceManager.getAgentStateStore();

    const steps = existingState.steps || {};
    // If forcing enhancement step, enable it regardless of original options
    const shouldEnhance = forceEnhance || (originalOptions.enhance && !originalOptions.fullyLocal);

    if (!shouldEnhance) {
      console.log('\n⏭️  STEP 5/5: Skipping Enhancement (disabled in original options)');
      return;
    }

    console.log('\n🎯 STEP 5/5: Re-running Enhancement');
    if (forceEnhance) {
      console.log('🧠 Force enabling GPT-4 enhancement (overriding original settings)');
    } else {
      console.log('🧠 Using original enhancement option: GPT-4 enhancement enabled');
    }

    const transcriptionResult = steps.transcribe_audio?.result;
    if (!transcriptionResult || !transcriptionResult.raw_text) {
      throw new Error('Transcription result not found in workflow state. Cannot resume enhancement.');
    }

    await stateStore.startStep(workflowId, 'enhance_transcription');

    try {
      const enhanceService = serviceManager.getGPTEnhancementService();
      
      const enhancedResult = await enhanceService.enhanceTranscription({
        fullText: transcriptionResult.raw_text,
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
        enhancement_time: 0,
        model_used: 'gpt-4'
      });

      console.log(`✅ Text re-enhanced: GPT-4 improved formatting and structure`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await stateStore.failStep(workflowId, 'enhance_transcription', { message: errorMessage });
      throw error;
    }
  }

  /**
   * Determine which step to resume from based on workflow state
   */
  determineResumeStep(steps: WorkflowSteps, forcedStep?: string): ResumeContext['resumeFromStep'] {
    // Handle forced step override
    if (forcedStep) {
      const stepMap: Record<string, ResumeContext['resumeFromStep']> = {
        'upload': 'upload_video',
        'audio': 'extract_audio', 
        'transcribe': 'transcribe_audio',
        'enhance': 'enhance_transcription'
      };

      if (stepMap[forcedStep]) {
        console.log(`🔄 Force restarting from: ${forcedStep} step (${stepMap[forcedStep]})`);
        console.log(`⚠️  This will overwrite existing results from this step onwards`);
        return stepMap[forcedStep];
      } else {
        console.log(`❌ Invalid step: ${forcedStep}. Valid steps: upload, audio, transcribe, enhance`);
        process.exit(1);
      }
    }

    // Auto-detect resume point based on completion status
    if (steps.enhance_transcription?.status === 'completed') {
      console.log('\n✅ Workflow already completed!');
      return 'completed';
    } else if (steps.transcribe_audio?.status === 'completed') {
      console.log('🎤 Resuming from enhancement step');
      return 'enhance_transcription';
    } else if (steps.extract_audio?.status === 'completed') {
      console.log('🎵 Resuming from transcription step');
      return 'transcribe_audio';
    } else if (steps.upload_video?.status === 'completed') {
      console.log('📤 Resuming from audio extraction step');
      return 'extract_audio';
    } else {
      console.log('📋 Resuming from video upload step');
      return 'upload_video';
    }
  }
}
