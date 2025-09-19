/**
 * Whisper Command Handler
 * Handles Whisper model management operations
 */

import { Command } from 'commander';
import { ServiceManager, logger } from '@video-transcribe/core';
import { WhisperOptions, CommandHandler } from '../types';

export class WhisperCommand implements CommandHandler {
  getDescription(): string {
    return 'Manage local Whisper models (download, cache, health check)';
  }

  validateOptions(options: WhisperOptions): boolean {
    // Ensure at least one option is provided
    const hasAction = Boolean(options.listModels || options.download || options.clearCache || options.cacheInfo || options.healthCheck);
    return hasAction;
  }

  setupCommand(program: Command): Command {
    return program
      .command('whisper')
      .description(this.getDescription())
      .option('--list-models', 'List available Whisper models and their sizes')
      .option('--download <model>', 'Download specific model (tiny|base|small|medium|large)')
      .option('--clear-cache', 'Clear all cached Whisper models')
      .option('--cache-info', 'Show cache directory info and downloaded models')
      .option('--health-check', 'Test Whisper service health and model availability')
      .action(async (options: WhisperOptions) => {
        await this.execute(options);
      });
  }

  async execute(options: WhisperOptions): Promise<void> {
    try {
      logger.info('Whisper management command...', { options });

      if (!this.validateOptions(options)) {
        console.log('❌ Please specify one of: --list-models, --download, --clear-cache, --cache-info, --health-check');
        process.exit(1);
      }

      const serviceManager = ServiceManager.getInstance();
      const whisperService = serviceManager.getWhisperService();

      if (options.listModels) {
        await this.listModels(whisperService);
      }

      if (options.download) {
        await this.downloadModel(whisperService, options.download);
      }

      if (options.clearCache) {
        await this.clearCache(whisperService);
      }

      if (options.cacheInfo) {
        await this.showCacheInfo(whisperService);
      }

      if (options.healthCheck) {
        await this.healthCheck(whisperService);
      }

    } catch (error) {
      logger.error('Whisper command failed:', error);
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  private async listModels(whisperService: any): Promise<void> {
    console.log('\n🤖 Available Whisper Models:');
    console.log('┌─────────┬─────────┬──────────────┬─────────────┐');
    console.log('│ Model   │ Size    │ Description  │ Quality     │');
    console.log('├─────────┼─────────┼──────────────┼─────────────┤');
    console.log('│ tiny    │ 39 MB   │ Fastest      │ Basic       │');
    console.log('│ base    │ 74 MB   │ Balanced     │ Good        │');
    console.log('│ small   │ 244 MB  │ Better       │ Better      │');
    console.log('│ medium  │ 769 MB  │ Good         │ Very Good   │');
    console.log('│ large   │ 1550 MB │ Best         │ Excellent   │');
    console.log('└─────────┴─────────┴──────────────┴─────────────┘');
    
    console.log('\n📋 Model Status:');
    const modelInfo = whisperService.getModelInfo();
    
    for (const [model, info] of Object.entries(modelInfo)) {
      const status = (info as any).cached ? '✅ Downloaded' : '⬇️  Available for download';
      const size = (info as any).size;
      console.log(`  ${model.padEnd(8)} ${size.padEnd(8)} ${status}`);
    }

    console.log('\n💡 Usage:');
    console.log('  video-transcribe whisper --download base     # Download base model');
    console.log('  video-transcribe transcribe video.mp4 --whisper-model base');
    console.log('  video-transcribe transcribe video.mp4 --whisper-quality accurate');
  }

  private async downloadModel(whisperService: any, model: string): Promise<void> {
    const validModels = ['tiny', 'base', 'small', 'medium', 'large'];
    if (!validModels.includes(model)) {
      console.log(`❌ Invalid model: ${model}`);
      console.log(`   Valid models: ${validModels.join(', ')}`);
      process.exit(1);
    }

    console.log(`\n📦 Downloading Whisper model: ${model}`);
    
    try {
      await whisperService.downloadModel(model, (progress: any) => {
        if (progress.type === 'download') {
          console.log(`⬇️  ${progress.message}`);
        }
      });
      
      console.log(`✅ Model ${model} downloaded successfully!`);
      console.log(`💡 Use with: video-transcribe transcribe video.mp4 --whisper-model ${model}`);
    } catch (error) {
      console.log(`❌ Failed to download model ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  private async clearCache(whisperService: any): Promise<void> {
    console.log('\n🗑️  Clearing Whisper model cache...');
    
    try {
      await whisperService.clearCache();
      console.log('✅ Cache cleared successfully!');
      console.log('💡 Models will be re-downloaded automatically when needed.');
    } catch (error) {
      console.log(`❌ Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  private async showCacheInfo(whisperService: any): Promise<void> {
    console.log('\n📁 Whisper Cache Information:');
    
    try {
      const modelInfo = whisperService.getModelInfo();
      const cacheDir = whisperService.getCacheDirectory?.() || 'Not available';
      
      console.log(`📂 Cache Directory: ${cacheDir}`);
      console.log('\n📋 Downloaded Models:');
      
      let totalSize = 0;
      let downloadedCount = 0;
      
      for (const [model, info] of Object.entries(modelInfo)) {
        const cached = (info as any).cached;
        const size = (info as any).size;
        
        if (cached) {
          console.log(`  ✅ ${model.padEnd(8)} ${size}`);
          // Parse size for total calculation
          const sizeMatch = size.match(/(\d+(?:\.\d+)?)\s*([KMGT]?B)/);
          if (sizeMatch) {
            const num = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2];
            const multiplier = unit === 'MB' ? 1 : unit === 'GB' ? 1024 : 1;
            totalSize += num * multiplier;
          }
          downloadedCount++;
        } else {
          console.log(`  ⬇️  ${model.padEnd(8)} ${size} (not downloaded)`);
        }
      }
      
      console.log(`\n📊 Summary:`);
      console.log(`  Downloaded: ${downloadedCount}/${Object.keys(modelInfo).length} models`);
      console.log(`  Total Size: ${totalSize > 1024 ? (totalSize / 1024).toFixed(1) + ' GB' : totalSize.toFixed(0) + ' MB'}`);
      
      if (downloadedCount === 0) {
        console.log('\n💡 No models downloaded yet. Use --download <model> to download a model.');
      }
    } catch (error) {
      console.log(`❌ Failed to get cache info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async healthCheck(whisperService: any): Promise<void> {
    console.log('\n🏥 Whisper Service Health Check:');
    
    try {
      const health = await whisperService.healthCheck();
      
      if (health.status === 'healthy') {
        console.log('✅ Whisper service is healthy');
        console.log(`   ${health.message}`);
        
        // Test with a simple model if available
        const modelInfo = whisperService.getModelInfo();
        const availableModels = Object.entries(modelInfo)
          .filter(([_, info]) => (info as any).cached)
          .map(([model, _]) => model);
          
        if (availableModels.length > 0) {
          console.log(`📋 Available models: ${availableModels.join(', ')}`);
        } else {
          console.log('📋 No models downloaded. Use --download <model> to download a model.');
        }
      } else {
        console.log('❌ Whisper service is unhealthy');
        console.log(`   ${health.message}`);
        
        console.log('\n🔧 Troubleshooting:');
        console.log('  1. Ensure @xenova/transformers is installed: npm install @xenova/transformers');
        console.log('  2. Check network connectivity for model downloads');
        console.log('  3. Verify sufficient disk space for model cache');
        console.log('  4. Try downloading a model: video-transcribe whisper --download base');
      }
    } catch (error) {
      console.log('❌ Health check failed');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      console.log('\n🔧 Troubleshooting:');
      console.log('  1. Check if the Whisper service is properly initialized');
      console.log('  2. Verify all dependencies are installed');
      console.log('  3. Check logs for more detailed error information');
    }
  }

  showUsageExamples(): void {
    console.log('\n📖 Whisper Command Examples:');
    console.log('');
    console.log('List all available models:');
    console.log('  video-transcribe whisper --list-models');
    console.log('');
    console.log('Download a specific model:');
    console.log('  video-transcribe whisper --download base');
    console.log('  video-transcribe whisper --download large');
    console.log('');
    console.log('Check cache status:');
    console.log('  video-transcribe whisper --cache-info');
    console.log('');
    console.log('Clear all cached models:');
    console.log('  video-transcribe whisper --clear-cache');
    console.log('');
    console.log('Test Whisper service:');
    console.log('  video-transcribe whisper --health-check');
    console.log('');
    console.log('Using models in transcription:');
    console.log('  video-transcribe transcribe video.mp4 --whisper-model base');
    console.log('  video-transcribe transcribe video.mp4 --whisper-quality best');
    console.log('  video-transcribe transcribe video.mp4 --language en');
    console.log('');
    console.log('Note: Whisper is the default transcription service.');
    console.log('Use --use-azure to override and use Azure Speech Services instead.');
    console.log('');
    console.log('Example usage:');
    console.log('  video-transcribe whisper --list-models');
    console.log('  video-transcribe whisper --download medium');
    console.log('  video-transcribe transcribe video.mp4 --whisper-quality accurate');
    console.log('  video-transcribe transcribe video.mp4 --use-azure  # Use Azure instead of default Whisper');
  }
}
