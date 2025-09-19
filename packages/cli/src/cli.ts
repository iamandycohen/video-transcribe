#!/usr/bin/env node

import { Command } from 'commander';
import { ServiceManager, logger, azureConfig } from '@video-transcribe/core';
import path from 'path';
import fs from 'fs';

// CLI option interfaces
interface TranscribeOptions {
  output: string;
  enhance: boolean;
  format: 'json' | 'txt' | 'both';
  keepAudio: boolean;
}

interface ConfigOptions {
  showKeys: boolean;
}

const program = new Command();

program
  .name('video-transcribe')
  .description('AI-powered video transcription using atomic services')
  .version('1.0.0');

program
  .command('transcribe')
  .description('Transcribe an MP4 video file or URL using modern workflow')
  .argument('<input-source>', 'Local file path or remote URL to MP4 video')
  .option('-o, --output <dir>', 'Output directory for results', azureConfig.app.outputDir)
  .option('--enhance', 'Enhance transcription using GPT models', true)
  .option('--format <format>', 'Output format (json|txt|both)', 'txt')
  .option('--keep-audio', 'Keep extracted audio file (default: false)', false)
  .action(async (inputSource: string, options: TranscribeOptions) => {
    try {
      logger.info('Starting atomic video transcription workflow...', { inputSource, options });
      
      const startTime = Date.now();
      
      // Get atomic services
      const serviceManager = ServiceManager.getInstance();
      const stateStore = serviceManager.getAgentStateStore();
      const referenceService = serviceManager.getReferenceService();

      console.log('\n🎬 Starting Atomic Video Transcription Workflow');
      console.log(`📥 Source: ${inputSource}`);
      console.log(`🎯 Enhancement: ${options.enhance ? 'Enabled' : 'Disabled'}`);
      console.log(`📄 Output Format: ${options.format}`);
      console.log(`🔄 Progress: Step-by-step atomic operations\n`);
      
      // Determine if input is URL or local file
      let isUrl = false;
      try {
        new URL(inputSource);
        isUrl = true;
        console.log('🌐 Remote URL detected - will download automatically');
      } catch {
        if (!fs.existsSync(inputSource)) {
          throw new Error(`Local file not found: ${inputSource}`);
        }
        console.log('📁 Local file detected');
      }

      // === STEP 1: CREATE WORKFLOW ===
      console.log('\n📋 STEP 1/5: Creating Workflow');
      const stepStart = Date.now();
      const workflowId = await stateStore.createWorkflow();
      console.log(`✅ Workflow created: ${workflowId} (${Date.now() - stepStart}ms)`);

      // === STEP 2: UPLOAD/STORE VIDEO ===
      console.log('\n📤 STEP 2/5: Processing Video Source');
      const uploadStart = Date.now();
      await stateStore.startStep(workflowId, 'upload_video');
      
      // Use appropriate method based on input type
      const videoUrl = isUrl 
        ? await referenceService.storeFromUrl(inputSource, workflowId)
        : await referenceService.storeFromPath(inputSource, workflowId);
      const fileInfo = await referenceService.getFileInfo(videoUrl);
      
      await stateStore.completeStep(workflowId, 'upload_video', {
        video_url: videoUrl,
        size: fileInfo?.size || 0,
        format: inputSource.split('.').pop()?.toLowerCase() || 'mp4',
        source_url: inputSource
      });
      
      const sizeInMB = fileInfo?.size ? (fileInfo.size / (1024 * 1024)).toFixed(1) : '?';
      console.log(`✅ Video processed: ${sizeInMB}MB (${Date.now() - uploadStart}ms)`);

      // === STEP 3: EXTRACT AUDIO ===
      console.log('\n🎵 STEP 3/5: Extracting Audio');
      const audioStart = Date.now();
      await stateStore.startStep(workflowId, 'extract_audio');
      
      // Use AudioExtractorService via ServiceManager
      const audioExtractor = serviceManager.getAudioExtractorService();
      
      const videoFilePath = referenceService.getFilePathFromUrl(videoUrl);
      const audioResult = await audioExtractor.extractAudioFromMp4(videoFilePath);
      
      // Store audio as reference
      const audioBuffer = await fs.promises.readFile(audioResult.audioFilePath);
      const audioUrl = await referenceService.storeAudio(audioBuffer, workflowId);
      
      await stateStore.completeStep(workflowId, 'extract_audio', {
        audio_url: audioUrl,
        extraction_time: 0,
        video_cleaned: !options.keepAudio, // Clean video unless keeping audio
        audio_size: audioBuffer.length
      });
      
      const audioSizeInMB = (audioBuffer.length / (1024 * 1024)).toFixed(1);
      console.log(`✅ Audio extracted: ${audioSizeInMB}MB WAV (${Date.now() - audioStart}ms)`);

      // === STEP 4: TRANSCRIBE AUDIO ===
      console.log('\n🎤 STEP 4/5: Transcribing Speech to Text');
      const transcribeStart = Date.now();
      await stateStore.startStep(workflowId, 'transcribe_audio');
      
      const transcribeService = serviceManager.getTranscribeAudioService();
      const audioFilePath = referenceService.getFilePathFromUrl(audioUrl);
      
      const transcriptionResult = await transcribeService.transcribeAudio({
        audioId: workflowId,
        audioFilePath: audioFilePath
      });

      if (!transcriptionResult.success) {
        throw new Error(`Transcription failed: ${transcriptionResult.error}`);
      }

      await stateStore.completeStep(workflowId, 'transcribe_audio', {
        raw_text: transcriptionResult.rawText,
        confidence: transcriptionResult.confidence,
        language: transcriptionResult.language,
        segments: transcriptionResult.segments,
        duration: transcriptionResult.duration,
        transcription_time: transcriptionResult.transcriptionTime,
        audio_cleaned: true
      });
      
      const confidence = transcriptionResult.confidence ? (transcriptionResult.confidence * 100).toFixed(1) : '?';
      const duration = transcriptionResult.duration ? (transcriptionResult.duration / 1000).toFixed(1) : '?';
      console.log(`✅ Speech transcribed: ${transcriptionResult.rawText?.length} chars, ${confidence}% confidence, ${duration}s duration (${Date.now() - transcribeStart}ms)`);

      // === STEP 5: ENHANCE WITH GPT (OPTIONAL) ===
      let finalText = transcriptionResult.rawText || '';
      let enhancedResult: { enhancedText: string; summary: string; keyPoints: string[]; topics: string[]; sentiment: string } | null = null;
      
      if (options.enhance) {
        console.log('\n✨ STEP 5/5: Enhancing with GPT-4');
        const enhanceStart = Date.now();
        await stateStore.startStep(workflowId, 'enhance_transcription');
        
        const enhanceService = serviceManager.getGPTEnhancementService();
        
        enhancedResult = await enhanceService.enhanceTranscription({
          fullText: transcriptionResult.rawText!,
          segments: transcriptionResult.segments || [],
          duration: transcriptionResult.duration || 0,
          language: transcriptionResult.language || 'en-US',
          confidence: transcriptionResult.confidence || 0
        });

        finalText = enhancedResult.enhancedText;
        
        await stateStore.completeStep(workflowId, 'enhance_transcription', {
          enhanced_text: enhancedResult.enhancedText,
          summary: enhancedResult.summary,
          key_points: enhancedResult.keyPoints,
          topics: enhancedResult.topics,
          sentiment: enhancedResult.sentiment,
          enhancement_time: 0,
          model_used: azureConfig.models.gptTranscribe
        });
        
        console.log(`✅ Text enhanced: GPT-4 improved formatting and structure (${Date.now() - enhanceStart}ms)`);
      } else {
        console.log('\n⏭️  STEP 5/5: Skipping GPT Enhancement (use --enhance to enable)');
      }

      console.log(`\n🎉 WORKFLOW COMPLETED SUCCESSFULLY!`);
      console.log(`🆔 Workflow ID: ${workflowId}`);
      
      // Save results
      if (options.format) {
        console.log('\n💾 Saving Results...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFileName = `atomic_transcription_${timestamp}`;
        
        // Ensure output directory exists
        if (!fs.existsSync(options.output)) {
          fs.mkdirSync(options.output, { recursive: true });
        }

        // Get the full workflow state for complete data
        const finalState = await stateStore.getState(workflowId);

        // Save JSON format
        if (options.format === 'json' || options.format === 'both') {
          const jsonPath = path.join(options.output, `${baseFileName}.json`);
          const jsonData = {
            source: inputSource,
            workflow_id: workflowId,
            timestamp: new Date().toISOString(),
            atomic_workflow: {
              total_steps: 5,
              enhancement_enabled: options.enhance,
              state: finalState
            },
            transcription: {
              raw_text: transcriptionResult.rawText,
              enhanced_text: enhancedResult?.enhancedText || null,
              final_text: finalText,
              confidence: transcriptionResult.confidence,
              language: transcriptionResult.language,
              segments: transcriptionResult.segments,
              duration: transcriptionResult.duration
            },
            file_info: {
              original_size_mb: fileInfo?.size ? (fileInfo.size / (1024 * 1024)) : null,
              audio_size_mb: audioBuffer.length / (1024 * 1024)
            },
            processing_times: {
              total: Date.now() - startTime,
              // Individual step times can be extracted from state if needed
            }
          };
          
          await fs.promises.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
          console.log(`📄 JSON results: ${jsonPath}`);
        }
        
        // Save TXT format
        if (options.format === 'txt' || options.format === 'both') {
          const txtPath = path.join(options.output, `${baseFileName}.txt`);
          const separator = '='.repeat(50);
          
          const content = `ATOMIC VIDEO TRANSCRIPTION RESULTS
${separator}

Generated: ${new Date().toISOString()}
Source: ${inputSource}
Workflow ID: ${workflowId}
Language: ${transcriptionResult.language || 'Unknown'}
Confidence: ${confidence}%
Duration: ${duration}s
Enhancement: ${options.enhance ? 'GPT-4 Enhanced' : 'Raw Transcription'}

${separator}
TRANSCRIPTION
${separator}

${finalText}

${enhancedResult && options.enhance ? `${separator}
ENHANCEMENT DETAILS
${separator}

Model: ${azureConfig.models.gptTranscribe}
Summary: ${enhancedResult.summary}
Key Points: ${enhancedResult.keyPoints?.join(', ')}
Topics: ${enhancedResult.topics?.join(', ')}
Sentiment: ${enhancedResult.sentiment}
Raw Length: ${transcriptionResult.rawText?.length} chars
Enhanced Length: ${enhancedResult.enhancedText?.length} chars

` : ''}`;
          
          await fs.promises.writeFile(txtPath, content);
          console.log(`📝 Text results: ${txtPath}`);
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      console.log('\n📊 FINAL SUMMARY');
      console.log(`⏱️  Total processing time: ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`🎯 Transcription confidence: ${confidence}%`);
      console.log(`🌍 Detected language: ${transcriptionResult.language || 'Unknown'}`);
      console.log(`📝 Final text length: ${finalText.length} characters`);
      console.log(`🔄 Workflow persisted with ID: ${workflowId}`);
      
      if (!options.keepAudio) {
        console.log('🧹 Temporary files cleaned up automatically');
      }
      
      process.exit(0);

    } catch (error) {
      logger.error('CLI transcription error:', error);
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check the health status of the transcription services')
  .action(async () => {
    try {
      const serviceManager = ServiceManager.getInstance();
      const healthService = serviceManager.getHealthCheckService();
      const status = await healthService.checkHealth();

      console.log('\n🔍 Atomic Video Transcription Status:');
      console.log(`Overall Health: ${status.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log('\nServices:');
      
      Object.entries(status.services).forEach(([service, healthy]) => {
        console.log(`  ${service}: ${healthy ? '✅' : '❌'}`);
      });
      
      console.log('\nAtomic Capabilities:');
      status.capabilities.forEach(capability => {
        console.log(`  ✅ ${capability}`);
      });

      if (status.status !== 'healthy') {
        process.exit(1);
      } else {
        process.exit(0);
      }

    } catch (error) {
      logger.error('Status check failed:', error);
      console.error('❌ Status check failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Display current configuration')
  .option('--show-keys', 'Show API keys (hidden by default)', false)
  .action((options: ConfigOptions) => {
    console.log('\n⚙️  Current Configuration:');
    console.log(`Subscription ID: ${azureConfig.subscriptionId}`);
    console.log(`Resource Group: ${azureConfig.resourceGroup}`);
    console.log(`Account Name: ${azureConfig.accountName}`);
    
    if (options.showKeys) {
      console.log(`API Key: ${azureConfig.apiKey}`);
    } else {
      console.log(`API Key: ${'*'.repeat(8)}...${azureConfig.apiKey.slice(-4)}`);
    }
    
    console.log('\nEndpoints:');
    Object.entries(azureConfig.endpoints).forEach(([name, url]) => {
      console.log(`  ${name}: ${url}`);
    });
    
    console.log('\nModels:');
    Object.entries(azureConfig.models).forEach(([name, model]) => {
      console.log(`  ${name}: ${model}`);
    });
    
    console.log('\nApp Settings:');
    console.log(`  Log Level: ${azureConfig.app.logLevel}`);
    console.log(`  Temp Directory: ${azureConfig.app.tempDir}`);
    console.log(`  Output Directory: ${azureConfig.app.outputDir}`);
    
    console.log('\n🔧 Atomic Services Available:');
    console.log('  • UploadVideoService');
    console.log('  • ExtractAudioService');
    console.log('  • TranscribeAudioService');
    console.log('  • EnhanceTranscriptionService');
    console.log('  • SummarizeContentService');
    console.log('  • ExtractKeyPointsService');
    console.log('  • AnalyzeSentimentService');
    console.log('  • IdentifyTopicsService');
    
    process.exit(0);
  });

// Error handling for actual errors (not commander help/version)
process.on('uncaughtException', (error: Error & { name?: string; code?: string }) => {
  // Don't log commander help/version display as errors
  if (error.name === 'CommanderError' && (error.code === 'commander.helpDisplayed' || error.code === 'commander.version')) {
    return;
  }
  logger.error('Uncaught exception:', error);
  console.error('❌ Unexpected error occurred. Check logs for details.');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error('❌ Unexpected error occurred. Check logs for details.');
  process.exit(1);
});

// Parse command line arguments if this file is run directly
if (require.main === module) {
  program.parse();
}

export { program };