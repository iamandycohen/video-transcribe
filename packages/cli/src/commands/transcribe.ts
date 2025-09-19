/**
 * Transcribe Command Handler
 * Handles the main video transcription workflow
 */

import { Command } from 'commander';
import { ServiceManager, logger, azureConfig } from '@video-transcribe/core';
import { TranscribeOptions, WorkflowContext, CommandHandler } from '../types';
import { WorkflowExecutor } from '../workflow/workflow-executor';
import { createOutputFormatter } from '../output/output-formatter';
import fs from 'fs';
import path from 'path';

export class TranscribeCommand implements CommandHandler {
  getDescription(): string {
    return 'Transcribe an MP4 video file or URL using modern workflow';
  }

  validateOptions(_options: TranscribeOptions): boolean {
    // Add validation logic here
    return true;
  }

  setupCommand(program: Command): Command {
    return program
      .command('transcribe')
      .description(this.getDescription())
      .argument('<input-source>', 'Local file path or remote URL to MP4 video')
      .option('-o, --output <dir>', 'Output directory for results', azureConfig.app.outputDir)
      .option('--enhance', 'Enhance transcription using GPT models', true)
      .option('--format <format>', 'Output format (json|txt|both|console)', 'txt')
      .option('--keep-audio', 'Keep extracted audio file (default: false)', false)
      .option('--verbose', 'Show detailed progress information', false)
      // Transcription service options
      .option('--use-azure', 'Use Azure Speech Services instead of local Whisper', false)
      .option('--whisper-model <model>', 'Whisper model: tiny|base|small|medium|large')
      .option('--whisper-quality <quality>', 'Quality preset: fast|balanced|accurate|best')
      .option('--language <lang>', 'Force specific language (e.g., "en", "es", "fr")')
      .option('--fully-local', 'Use local processing for everything (Whisper + no cloud AI)', false)
      .option('--whisper-cache-dir <dir>', 'Custom directory for Whisper model cache')
      .action(async (inputSource: string, options: TranscribeOptions) => {
        await this.execute(inputSource, options);
      });
  }

  async execute(inputSource: string, options: TranscribeOptions): Promise<void> {
    try {
      logger.info('Starting atomic video transcription workflow...', { inputSource, options });
      
      const startTime = Date.now();
      
      // Get atomic services
      // const serviceManager = ServiceManager.getInstance();
      // const stateStore = serviceManager.getAgentStateStore();
      // const referenceService = serviceManager.getReferenceService();

      console.log('\n🎬 Starting Atomic Video Transcription Workflow');
      console.log(`📥 Source: ${inputSource}`);
      console.log(`🎙️ Transcription: ${options.useAzure ? 'Azure Speech Services' : 'Local Whisper (default)'}`);
      if (!options.useAzure) {
        const modelOrQuality = options.whisperModel || (options.whisperQuality ? `${options.whisperQuality} (${options.whisperQuality === 'fast' ? 'tiny' : options.whisperQuality === 'balanced' ? 'base' : options.whisperQuality === 'accurate' ? 'medium' : 'large'})` : 'base');
        console.log(`🤖 Whisper Model: ${modelOrQuality}`);
        if (options.language) console.log(`🌐 Language: ${options.language}`);
      }
      console.log(`🎯 Enhancement: ${options.fullyLocal ? 'Disabled (fully local)' : options.enhance ? 'Enabled (GPT-4)' : 'Disabled'}`);
      console.log(`📄 Output Format: ${options.format}`);
      console.log(`🔄 Progress: Step-by-step atomic operations\n`);
      
      // Determine if input is URL or local file
      let isUrl = false;
      try {
        new URL(inputSource);
        isUrl = true;
        console.log('🌐 Remote URL detected - will download automatically');
      } catch {
        // Not a URL, check if local file exists
        if (!fs.existsSync(inputSource)) {
          throw new Error(`Local file not found: ${inputSource}`);
        }
        console.log('📁 Local file detected');
      }

      const context: WorkflowContext = {
        workflowId: '',
        inputSource,
        options,
        isUrl,
        startTime
      };

      // Execute the workflow
      await this.executeWorkflow(context);

    } catch (error) {
      logger.error('Transcribe command failed:', error);
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  private async executeWorkflow(context: WorkflowContext): Promise<void> {
    const { inputSource, options } = context;
    const serviceManager = ServiceManager.getInstance();
    const stateStore = serviceManager.getAgentStateStore();

    // === STEP 1: CREATE WORKFLOW ===
    console.log('\n📋 STEP 1/5: Creating Workflow');
    const stepStart = Date.now();
    const workflowId = await stateStore.createWorkflow();
    context.workflowId = workflowId;
    
    // Store original options for resume functionality
    await stateStore.updateState(workflowId, {
      original_input: inputSource,
      original_options: options
    });
    
    console.log(`✅ Workflow created: ${workflowId} (${Date.now() - stepStart}ms)`);

    // === EXECUTE WORKFLOW USING WORKFLOW EXECUTOR ===
    const workflowExecutor = new WorkflowExecutor(context);
    await workflowExecutor.executeWorkflow(context);

    // === OUTPUT RESULTS ===
    await this.outputResults(context);
  }

  private async outputResults(context: WorkflowContext): Promise<void> {
    const { workflowId, options } = context;
    
    console.log('\n🎉 WORKFLOW COMPLETED SUCCESSFULLY!');
    console.log(`🆔 Workflow ID: ${workflowId}`);

    // Use the OutputFormatter for consistent formatting
    const formatter = createOutputFormatter(options.format);
    
    await formatter.format(context, {
      format: options.format,
      outputDir: path.resolve(options.output),
      verbose: options.verbose
    });
  }

  // Note: Legacy workflow execution methods removed - now handled by WorkflowExecutor class
}