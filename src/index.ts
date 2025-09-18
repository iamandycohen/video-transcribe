#!/usr/bin/env node

import { program } from './cli/cli';
import { logger } from './utils/logger';
import { validateConfig } from './config/azure-config';

async function main() {
  try {
    // Validate configuration first (will throw if invalid)
    validateConfig();
    
    // Parse command line arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error && error.message.includes('commander')) {
      // Commander.js error (like help, version, etc.)
      process.exit(0);
    }
    
    logger.error('Application error:', error);
    console.error('❌ Application error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main();
}

// TranscriptionAgent removed - use atomic services instead:
export { UploadVideoService } from './services/upload-video-service';
export { ExtractAudioService } from './services/extract-audio-service';
export { TranscribeAudioService } from './services/transcribe-audio-service';
export { EnhanceTranscriptionService } from './services/enhance-transcription-service';
export { SummarizeContentService } from './services/summarize-content-service';
export { ExtractKeyPointsService } from './services/extract-key-points-service';
export { AnalyzeSentimentService } from './services/analyze-sentiment-service';
export { IdentifyTopicsService } from './services/identify-topics-service';
export { HealthCheckService } from './services/health-check-service';
export { TranscriptionService } from './services/transcription-service';
export { GPTEnhancementService } from './services/gpt-enhancement-service';
export { AudioExtractorService } from './services/audio-extractor';
export { azureConfig } from './config/azure-config';

