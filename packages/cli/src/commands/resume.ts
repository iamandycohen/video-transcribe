/**
 * Resume Command Handler
 * Handles resuming interrupted workflows from where they left off
 */

import { Command } from 'commander';
import { ServiceManager, logger, azureConfig } from '@video-transcribe/core';
import { ResumeOptions, ResumeContext, CommandHandler } from '../types';
import fs from 'fs';
import path from 'path';

export class ResumeCommand implements CommandHandler {
  getDescription(): string {
    return 'Resume a workflow from where it left off';
  }

  validateOptions(_options: ResumeOptions): boolean {
    // Add validation logic here
    return true;
  }

  setupCommand(program: Command): Command {
    return program
      .command('resume')
      .description(this.getDescription())
      .argument('<workflow-id>', 'Workflow ID to resume')
      .option('-o, --output <dir>', 'Output directory for results', azureConfig.app.outputDir)
      .option('--format <format>', 'Output format (json|txt|both|console)', 'txt')
      .option('--verbose', 'Show detailed progress information', false)
      .option('--from-step <step>', 'Force restart from specific step: upload|audio|transcribe|enhance')
      .action(async (workflowId: string, options: ResumeOptions) => {
        await this.execute(workflowId, options);
      });
  }

  async execute(workflowId: string, options: ResumeOptions): Promise<void> {
    try {
      logger.info('Resuming workflow...', { workflowId, options });

      const serviceManager = ServiceManager.getInstance();
      const stateStore = serviceManager.getAgentStateStore();
      // const referenceService = serviceManager.getReferenceService();

      console.log('\n🔄 Resuming Workflow');
      console.log(`📋 Workflow ID: ${workflowId}`);
      
      const existingState = await stateStore.getState(workflowId);
      
      if (!existingState) {
        console.error(`❌ Workflow ${workflowId} not found`);
        process.exit(1);
      }

      console.log(`📅 Created: ${new Date(existingState.created_at).toLocaleString()}`);
      console.log(`🕐 Last Updated: ${new Date(existingState.last_updated).toLocaleString()}`);
      
      // Get original options from workflow state (needed early for output formatting)
      const originalOptions = existingState.original_options || {};
      const originalInput = existingState.original_input || '';
      
      const context: ResumeContext = {
        workflowId,
        existingState,
        originalOptions,
        originalInput,
        resumeFromStep: this.determineResumeStep(existingState.steps || {}, options.fromStep)
      };

      await this.executeResume(context, options);

    } catch (error) {
      logger.error('Resume workflow failed:', error);
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  private determineResumeStep(steps: any, forcedStep?: string): ResumeContext['resumeFromStep'] {
    // Handle forced step override
    if (forcedStep) {
      const stepMapping = {
        'upload': 'upload_video',
        'audio': 'extract_audio', 
        'transcribe': 'transcribe_audio',
        'enhance': 'enhance_transcription'
      };
      
      const mappedStep = stepMapping[forcedStep as keyof typeof stepMapping];
      if (mappedStep) {
        console.log(`🔄 Force restarting from: ${forcedStep} step (${mappedStep})`);
        console.log(`⚠️  This will overwrite existing results from this step onwards`);
        return mappedStep as ResumeContext['resumeFromStep'];
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

  private async executeResume(context: ResumeContext, options: ResumeOptions): Promise<void> {
    const { workflowId, existingState, originalOptions, originalInput, resumeFromStep } = context;
    const serviceManager = ServiceManager.getInstance();
    const stateStore = serviceManager.getAgentStateStore();
    // const referenceService = serviceManager.getReferenceService();

    // Handle completed workflow
    if (resumeFromStep === 'completed') {
      await this.outputCompletedResults(context, options);
      return;
    }

    console.log(`📥 Original Input: ${originalInput}`);
    console.log(`⚙️  Original Options: ${Object.entries(originalOptions).map(([k, v]) => `${k}=${v}`).join(', ')}`);

    // Get stored file references
    const steps = existingState.steps || {};
    const videoUrl = steps.upload_video?.result?.video_url;
    const audioUrl = steps.extract_audio?.result?.audio_url;
    
    if (!videoUrl) {
      console.log('❌ Cannot resume: No video file found in workflow');
      process.exit(1);
    }

    console.log(`📥 Using stored video: ${path.basename(videoUrl)}`);
    if (audioUrl) {
      console.log(`🎵 Using stored audio: ${path.basename(audioUrl)}`);
    }

    // Resume from the appropriate step using original options
    if (resumeFromStep === 'extract_audio') {
      await this.resumeAudioExtraction(context);
      // Update audio URL after extraction
      const updatedState = await stateStore.getState(workflowId);
      if (updatedState) {
        context.existingState = updatedState;
      }
    }

    if (resumeFromStep === 'transcribe_audio' || resumeFromStep === 'extract_audio') {
      await this.resumeTranscription(context);
    }

    if (resumeFromStep === 'enhance_transcription' || resumeFromStep === 'transcribe_audio' || resumeFromStep === 'extract_audio') {
      const forceEnhance = resumeFromStep === 'enhance_transcription';
      await this.resumeEnhancement(context, forceEnhance);
    }

    console.log(`\n🎉 WORKFLOW RESUMED AND COMPLETED SUCCESSFULLY!`);
    console.log(`🆔 Workflow ID: ${workflowId}`);
    
    // Always show results when resuming completed workflow
    await this.outputCompletedResults(context, options);
  }

  private async outputCompletedResults(context: ResumeContext, options: ResumeOptions): Promise<void> {
    const { workflowId, existingState, originalOptions } = context;
    const steps = existingState.steps || {};
    
    // Extract final results and output them
    const videoResult = steps.upload_video?.result;
    const transcriptionResult = steps.transcribe_audio?.result;
    const enhancementResult = steps.enhance_transcription?.result;
    
    if (transcriptionResult) {
      console.log(`\n📄 TRANSCRIPTION RESULTS`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Source: ${videoResult?.source_url || videoResult?.video_url || 'Unknown'}`);
      console.log(`Workflow ID: ${workflowId}`);
      console.log(`Language: ${transcriptionResult.language || 'Unknown'}`);
      console.log(`Duration: ${transcriptionResult.duration || 'Unknown'}`);
      
      // Use original format or override with command option
      const outputFormat = options.format || originalOptions.format || 'console';
      const outputDir = options.output || originalOptions.output || './output';
      
      console.log(`📄 Using output format: ${outputFormat} (${options.format ? 'command override' : 'original option'})`);
      
      if (outputFormat === 'console') {
        console.log(`\nRaw Text:\n${transcriptionResult.raw_text}`);
        if (enhancementResult) {
          console.log(`\n=== ENHANCED TEXT ===`);
          console.log(`${(enhancementResult as any).enhanced_text || 'None'}`);
          console.log(`\n=== ENHANCED SUMMARY ===`);
          console.log(`${(enhancementResult as any).summary || 'None'}`);
          console.log(`\n=== KEY POINTS ===`);
          console.log(`${(enhancementResult as any).key_points?.join('\n') || 'None'}`);
          console.log(`\n=== TOPICS ===`);
          console.log(`${(enhancementResult as any).topics?.join(', ') || 'None'}`);
          console.log(`\n=== SENTIMENT ===`);
          console.log(`${(enhancementResult as any).sentiment || 'None'}`);
        }
      } else {
        // Save to files
        await fs.promises.mkdir(outputDir, { recursive: true });
        
        if (outputFormat === 'json' || outputFormat === 'both') {
          const jsonData = {
            workflow_id: workflowId,
            source: videoResult?.source_url || videoResult?.video_url,
            transcription: transcriptionResult,
            enhancement: enhancementResult
          };
          const jsonPath = path.join(outputDir, `${workflowId}.json`);
          await fs.promises.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
          console.log(`💾 Results saved: ${jsonPath}`);
        }
        
        if (outputFormat === 'txt' || outputFormat === 'both') {
          const txtContent = `Video Transcription Results
${'='.repeat(40)}
Source: ${videoResult?.source_url || videoResult?.video_url || 'Unknown'}
Workflow ID: ${workflowId}
Date: ${new Date().toLocaleString()}

Raw Transcription:
${transcriptionResult.raw_text}

${enhancementResult ? `
Enhanced Summary:
${(enhancementResult as any).summary}

Key Points:
${(enhancementResult as any).key_points?.map((point: string) => `• ${point}`).join('\n') || 'None'}

Topics:
${(enhancementResult as any).topics?.join(', ') || 'None'}

Sentiment: ${(enhancementResult as any).sentiment || 'Unknown'}
` : ''}`;
          const txtPath = path.join(outputDir, `${workflowId}.txt`);
          await fs.promises.writeFile(txtPath, txtContent);
          console.log(`💾 Results saved: ${txtPath}`);
        }
      }
    }
  }

  private async resumeAudioExtraction(context: ResumeContext): Promise<void> {
    const { workflowId, existingState } = context;
    const serviceManager = ServiceManager.getInstance();
    const stateStore = serviceManager.getAgentStateStore();
    const referenceService = serviceManager.getReferenceService();

    const steps = existingState.steps || {};
    const videoUrl = steps.upload_video?.result?.video_url;

    console.log('\n🎵 STEP 3/5: Re-extracting Audio');
    await stateStore.startStep(workflowId, 'extract_audio');
    
    const audioExtractor = serviceManager.getAudioExtractorService();
    
    if (!videoUrl) {
      throw new Error('Video URL not found in workflow state');
    }
    
    const videoFilePath = referenceService.getFilePathFromUrl(videoUrl);
    const audioResult = await audioExtractor.extractAudioFromMp4(videoFilePath);
    
    // Store audio as reference
    const audioBuffer = await fs.promises.readFile(audioResult.audioFilePath);
    const resumeAudioUrl = await referenceService.storeAudio(audioBuffer, workflowId);
    
    await stateStore.completeStep(workflowId, 'extract_audio', {
      audio_url: resumeAudioUrl,
      extraction_time: 0,
      video_cleaned: true,
      audio_size: audioBuffer.length
    });
    
    console.log('✅ Audio extracted successfully');
  }

  private async resumeTranscription(context: ResumeContext): Promise<void> {
    const { workflowId, existingState, originalOptions } = context;
    const serviceManager = ServiceManager.getInstance();
    const stateStore = serviceManager.getAgentStateStore();
    // const referenceService = serviceManager.getReferenceService();

    const steps = existingState.steps || {};
    const audioUrl = steps.extract_audio?.result?.audio_url;
    
    console.log('\n🎤 STEP 4/5: Re-running Transcription');
    console.log(`🎙️ Using original transcription method: ${originalOptions.useAzure ? 'Azure Speech Services' : 'Local Whisper'}`);
    
    await stateStore.startStep(workflowId, 'transcribe_audio');
    
    if (!audioUrl) {
      console.log('❌ Cannot resume: No audio file found');
      process.exit(1);
    }
    
    if (!originalOptions.useAzure) {
      await this.executeWhisperTranscription(context, audioUrl);
    } else {
      await this.executeAzureTranscription(context, audioUrl);
    }
  }

  private async executeWhisperTranscription(context: ResumeContext, audioUrl: string): Promise<void> {
    const { workflowId, originalOptions } = context;
    const serviceManager = ServiceManager.getInstance();
    const stateStore = serviceManager.getAgentStateStore();
    const referenceService = serviceManager.getReferenceService();

    const whisperService = serviceManager.getWhisperService();
    const model = originalOptions.whisperModel || 
      (originalOptions.whisperQuality ? 
        ({'fast': 'tiny', 'balanced': 'base', 'accurate': 'medium', 'best': 'large'} as any)[originalOptions.whisperQuality] || 'base' : 
        'base');
    
    console.log(`🤖 Using original Whisper model: ${model}`);
    if (originalOptions.language) {
      console.log(`🌐 Using original language: ${originalOptions.language}`);
    }
    
    try {
      const audioFilePath = referenceService.getFilePathFromUrl(audioUrl);
      
      const whisperOptions = {
        model: model as any,
        quality: originalOptions.whisperQuality as any,
        language: originalOptions.language,
        cacheDir: originalOptions.whisperCacheDir,
        verbose: false
      };
      
      const whisperResult = await whisperService.transcribeAudio(audioFilePath, whisperOptions);
      
      // Convert Whisper result to expected format
      const transcriptionResult = {
        success: true,
        rawText: whisperResult.text,
        confidence: null,
        language: whisperResult.language,
        segments: whisperResult.segments
      };
      
      await stateStore.completeStep(workflowId, 'transcribe_audio', {
        raw_text: transcriptionResult.rawText,
        confidence: transcriptionResult.confidence,
        language: transcriptionResult.language,
        segments: transcriptionResult.segments,
        duration: whisperResult.duration,
        transcription_time: 0,
        audio_cleaned: true
      });
      
      console.log('✅ Transcription completed successfully with Whisper');
    } catch (error) {
      console.log('⚠️  Whisper failed, trying Azure fallback...');
      await this.executeAzureTranscription(context, audioUrl);
    }
  }

  private async executeAzureTranscription(context: ResumeContext, audioUrl: string): Promise<void> {
    const { workflowId } = context;
    const serviceManager = ServiceManager.getInstance();
    const stateStore = serviceManager.getAgentStateStore();
    const referenceService = serviceManager.getReferenceService();

    console.log('🔵 Using Azure Speech Services');
    const audioFilePath = referenceService.getFilePathFromUrl(audioUrl);
    const transcribeService = serviceManager.getTranscribeAudioService();
    const azureResult = await transcribeService.transcribeAudio({
      audioId: workflowId,
      audioFilePath: audioFilePath
    });
    
    await stateStore.completeStep(workflowId, 'transcribe_audio', {
      raw_text: azureResult.rawText,
      confidence: azureResult.confidence,
      language: azureResult.language,
      segments: azureResult.segments,
      duration: azureResult.duration,
      transcription_time: azureResult.transcriptionTime,
      audio_cleaned: true
    });
    
    console.log('✅ Transcription completed with Azure Speech Services');
  }

  private async resumeEnhancement(context: ResumeContext, forceEnhance = false): Promise<void> {
    const { workflowId, existingState, originalOptions } = context;
    const serviceManager = ServiceManager.getInstance();
    const stateStore = serviceManager.getAgentStateStore();

    const steps = existingState.steps || {};
    // If forcing enhancement step, enable it regardless of original options
    const shouldEnhance = forceEnhance || (originalOptions.enhance && !originalOptions.fullyLocal);
    
    if (shouldEnhance) {
      console.log('\n🎯 STEP 5/5: Re-running Enhancement');
      if (forceEnhance) {
        console.log('🧠 Force enabling GPT-4 enhancement (overriding original settings)');
      } else {
        console.log('🧠 Using original enhancement option: GPT-4 enhancement enabled');
      }
      
      await stateStore.startStep(workflowId, 'enhance_transcription');
      
      const transcriptionResult = steps.transcribe_audio?.result;
      if (!transcriptionResult) {
        console.log('❌ Cannot resume: No transcription found');
        process.exit(1);
      }
      
      const enhanceService = serviceManager.getGPTEnhancementService();
      
      const enhancementResult = await enhanceService.enhanceTranscription({
        fullText: transcriptionResult.raw_text,
        segments: transcriptionResult.segments || [],
        duration: transcriptionResult.duration || 0,
        language: transcriptionResult.language || 'en-US',
        confidence: transcriptionResult.confidence || 0
      });
      
      await stateStore.completeStep(workflowId, 'enhance_transcription', {
        enhanced_text: enhancementResult.enhancedText,
        summary: enhancementResult.summary,
        key_points: enhancementResult.keyPoints,
        topics: enhancementResult.topics,
        sentiment: enhancementResult.sentiment,
        enhancement_time: 0,
        model_used: azureConfig.models.gptTranscribe
      });
      
      console.log('✅ Enhancement completed successfully');
    } else if (originalOptions.fullyLocal) {
      console.log('\n🏠 STEP 5/5: Skipping Enhancement (original fully local mode)');
    } else {
      console.log('\n⏭️  STEP 5/5: Skipping Enhancement (original option: enhancement disabled)');
    }
  }
}
