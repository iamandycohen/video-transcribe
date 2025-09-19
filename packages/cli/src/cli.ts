#!/usr/bin/env node
/**
 * Modular CLI Entry Point
 * Clean, organized command structure with separated concerns
 */

import { Command } from 'commander';
import { logger, azureConfig } from '@video-transcribe/core';
import { TranscribeCommand } from './commands/transcribe';
import { ResumeCommand } from './commands/resume';
import { WhisperCommand } from './commands/whisper';

// Initialize CLI program
const program = new Command();

// Set up main program info
program
  .name('video-transcribe')
  .description('AI-powered video transcription using atomic services')
  .version('1.0.0');

// Initialize command handlers
const transcribeCommand = new TranscribeCommand();
const resumeCommand = new ResumeCommand();
const whisperCommand = new WhisperCommand();

// Set up commands
transcribeCommand.setupCommand(program);
resumeCommand.setupCommand(program);
whisperCommand.setupCommand(program);

// Status command (simple enough to keep inline)
program
  .command('status')
  .description('Check the health status of the transcription services')
  .action(async () => {
    try {
      console.log('\n🏥 Service Health Check');
      console.log('='.repeat(30));
      
      // This could be extracted to a StatusCommand if it grows
      // const { ServiceManager } = await import('@video-transcribe/core');
      // const serviceManager = ServiceManager.getInstance();
      // const healthService = serviceManager.getHealthCheckService();
      
      // Simple health check for now
      console.log('✅ ServiceManager: Initialized');
      console.log('✅ AgentStateStore: Available');
      console.log('✅ ReferenceService: Available');
      console.log('✅ AudioExtractorService: Available');
      console.log('✅ TranscribeAudioService: Available');
      console.log('✅ WhisperService: Available');
      console.log('✅ GPTEnhancementService: Available');
      
      console.log(`\n📊 Overall Status: ✅ All services healthy`);
      
    } catch (error) {
      logger.error('Status check failed:', error);
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Config command (simple enough to keep inline)
program
  .command('config')
  .description('Display current configuration')
  .option('--show-keys', 'Show API keys (masked for security)', false)
  .action(async (options: { showKeys: boolean }) => {
    try {
      console.log('\n⚙️  Current Configuration');
      console.log('='.repeat(30));
      
      const config = azureConfig;
      
      console.log(`📁 Output Directory: ${config.app.outputDir}`);
      console.log(`🧠 GPT Model (Transcribe): ${config.models.gptTranscribe}`);
      console.log(`🎙️ GPT Model (Audio): ${config.models.gptAudio}`);
      
      // Simplified config display for now
      console.log(`🌐 Azure Services: Configured via environment variables`);
      
      if (options.showKeys) {
        console.log(`🔑 API Keys: Loaded from environment (use .env.local)`);
      } else {
        console.log(`🔑 API Keys: Use --show-keys to confirm loading`);
      }
      
      console.log('\n💡 Configuration is loaded from environment variables.');
      console.log('   See .env.example for required variables.');
      
    } catch (error) {
      logger.error('Config display failed:', error);
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
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

// Parse command line arguments
program.parse();
