/**
 * Services Export Index
 * Provides clean imports for external usage
 */

// Core Services
export { ServiceManager } from './service-manager';
export { AgentStateStore } from './agent-state-store';
export { ReferenceService } from './reference-service';

// Processing Services
export { UploadVideoService } from './upload-video-service';
export { ExtractAudioService } from './extract-audio-service';
export { TranscribeAudioService } from './transcribe-audio-service';
export { EnhanceTranscriptionService } from './enhance-transcription-service';

// Audio Services
export { AudioExtractorService } from './audio-extractor';
export { WhisperService } from './whisper-service';

// Analysis Services
export { AnalyzeSentimentService } from './analyze-sentiment-service';
export { ExtractKeyPointsService } from './extract-key-points-service';
export { IdentifyTopicsService } from './identify-topics-service';
export { SummarizeContentService } from './summarize-content-service';
export { GPTEnhancementService } from './gpt-enhancement-service';

// Utility Services
export { HealthCheckService } from './health-check-service';
export { WorkflowCleanupService } from './workflow-cleanup';
export { AzureClientService } from './azure-client';

// Type exports
export type { 
  AgentState, 
  LegacyAgentState
} from './agent-state-store';

export type { FileReference } from './reference-service';

export type { 
  WhisperModel, 
  WhisperQuality, 
  WhisperOptions, 
  WhisperResult, 
  WhisperProgress 
} from './whisper-service';

// Re-export workflow types
export type { 
  StepStatus, 
  StepError, 
  WorkflowSteps 
} from '../workflow-steps';
