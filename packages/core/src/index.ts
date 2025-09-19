/**
 * @video-transcribe/core - Core video transcription library
 * 
 * Main exports for the core library package
 */

// Main Agent Class (both APIs)
export { 
  TranscriptionAgent,
  ProcessVideoOptions,
  ProcessVideoResult,
  TranscribeVideoOptions, 
  TranscribeVideoResult,
  HealthCheckResult,
  ToolDescription
} from './agent/transcription-agent';

// Atomic Services (for advanced users)
export {
  ServiceManager,
  AgentStateStore,
  ReferenceService,
  UploadVideoService,
  ExtractAudioService,
  TranscribeAudioService,
  EnhanceTranscriptionService,
  AudioExtractorService,
  AnalyzeSentimentService,
  ExtractKeyPointsService,
  IdentifyTopicsService,
  SummarizeContentService,
  HealthCheckService,
  WorkflowCleanupService,
  AzureClientService,
  GPTEnhancementService
} from './services';

// Service Types
export type {
  AgentState,
  LegacyAgentState,
  FileReference,
  StepStatus,
  StepError,
  WorkflowSteps
} from './services';

// Configuration
export { azureConfig, validateConfig } from './config/azure-config';

// Utilities
export { logger } from './utils/logger';

// Progress Types (for framework-agnostic progress reporting)
export {
  ProgressAggregator,
  ProgressReporters,
  ProgressEvent,
  ProgressCallback,
  ProgressType
} from './types/progress';

// Version
export { getVersionInfo } from './version';
