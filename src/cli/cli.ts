import { Command } from 'commander';
import { UploadVideoService } from '../services/upload-video-service';
import { ExtractAudioService } from '../services/extract-audio-service';
import { TranscribeAudioService } from '../services/transcribe-audio-service';
import { EnhanceTranscriptionService } from '../services/enhance-transcription-service';
import { SummarizeContentService } from '../services/summarize-content-service';
import { HealthCheckService } from '../services/health-check-service';
import { logger } from '../utils/logger';
import { azureConfig } from '../config/azure-config';
import path from 'path';

const program = new Command();

program
  .name('video-transcribe')
  .description('AI-powered video transcription using atomic services')
  .version('1.0.0');

program
  .command('transcribe')
  .description('Transcribe an MP4 video file using atomic workflow')
  .argument('<input-file>', 'Path to the MP4 file to transcribe')
  .option('-o, --output <dir>', 'Output directory for results', azureConfig.app.outputDir)
  .option('--enhance', 'Enhance transcription using GPT models', false)
  .option('--summarize', 'Generate summary', false)
  .option('--format <format>', 'Output format (json|txt|both)', 'both')
  .action(async (inputFile: string, options: any) => {
    try {
      logger.info('Starting atomic video transcription workflow...');
      
      // Resolve absolute path
      const absoluteInputPath = path.resolve(inputFile);
      const startTime = Date.now();
      
      // Initialize atomic services
      const uploadService = new UploadVideoService();
      const extractAudioService = new ExtractAudioService();
      const transcribeAudioService = new TranscribeAudioService();
      const enhanceTranscriptionService = new EnhanceTranscriptionService();
      const summarizeContentService = new SummarizeContentService();

      console.log('\n🎬 Starting atomic video transcription workflow...');
      
      // Step 1: Upload video
      console.log('📤 Step 1: Storing video...');
      const uploadResult = await uploadService.storeVideoFromPath(absoluteInputPath);
      console.log(`✅ Video stored with ID: ${uploadResult.uploadId}`);
      
      // Step 2: Extract audio
      console.log('🎵 Step 2: Extracting audio...');
      const audioResult = await extractAudioService.extractAudio({ uploadId: uploadResult.uploadId });
      if (!audioResult.success) {
        throw new Error(`Audio extraction failed: ${audioResult.error}`);
      }
      console.log(`✅ Audio extracted with ID: ${audioResult.audioId}`);
      
      // Step 3: Transcribe audio
      console.log('🎤 Step 3: Transcribing audio to text...');
      const transcriptionResult = await transcribeAudioService.transcribeAudio({
        audioId: audioResult.audioId,
        audioFilePath: audioResult.audioFilePath
      });
      if (!transcriptionResult.success) {
        throw new Error(`Transcription failed: ${transcriptionResult.error}`);
      }
      console.log(`✅ Transcription completed with ID: ${transcriptionResult.transcriptionId}`);
      
      let finalText = transcriptionResult.rawText;
      let summary: string | null = null;
      
      // Step 4: Enhance transcription (optional)
      if (options.enhance) {
        console.log('✨ Step 4: Enhancing transcription with GPT...');
        const enhanceResult = await enhanceTranscriptionService.enhanceTranscription({
          text: transcriptionResult.rawText
        });
        if (enhanceResult.success) {
          finalText = enhanceResult.enhancedText;
          console.log(`✅ Transcription enhanced with ID: ${enhanceResult.enhancementId}`);
        } else {
          console.warn(`⚠️ Enhancement failed: ${enhanceResult.error}`);
        }
      }
      
      // Step 5: Generate summary (optional)
      if (options.summarize) {
        console.log('📝 Step 5: Generating summary...');
        const summaryResult = await summarizeContentService.summarizeContent({
          text: finalText
        });
        if (summaryResult.success) {
          summary = summaryResult.summary;
          console.log(`✅ Summary generated with ID: ${summaryResult.summaryId}`);
        } else {
          console.warn(`⚠️ Summary generation failed: ${summaryResult.error}`);
        }
      }
      
      // Save results if needed
      if (options.format !== 'none') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFileName = `atomic_workflow_${timestamp}`;
        
        if (options.format === 'txt' || options.format === 'both') {
          const fs = await import('fs');
          const txtPath = path.join(options.output, `${baseFileName}_text.txt`);
          let content = `Atomic Video Transcription - ${new Date().toISOString()}\n`;
          content += `Source: ${inputFile}\n\n`;
          content += `=== TRANSCRIPTION ===\n${finalText}\n\n`;
          
          if (summary) {
            content += `=== SUMMARY ===\n${summary}\n\n`;
          }
          
          await fs.promises.writeFile(txtPath, content);
          console.log(`💾 Results saved to: ${txtPath}`);
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      console.log('\n✅ Atomic transcription workflow completed successfully!');
      console.log(`⏱️  Total processing time: ${totalTime}ms`);
      console.log(`🎯 Confidence: ${(transcriptionResult.confidence * 100).toFixed(1)}%`);
      console.log(`📝 Text length: ${finalText.length} characters`);
      
      if (summary) {
        console.log(`📄 Summary: ${summary.substring(0, 100)}...`);
      }
      
      // Cleanup
      await extractAudioService.cleanupAudio(audioResult.audioId);
      await uploadService.deleteUploadedVideo(uploadResult.uploadId);
      
      process.exit(0);

    } catch (error) {
      logger.error('CLI atomic workflow error:', error);
      console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check the health status of the transcription services')
  .action(async () => {
    try {
      const healthService = new HealthCheckService();
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
  .action((options: any) => {
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

// Error handling
program.exitOverride();

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error('❌ Unexpected error occurred. Check logs for details.');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error('❌ Unexpected error occurred. Check logs for details.');
  process.exit(1);
});

export { program };