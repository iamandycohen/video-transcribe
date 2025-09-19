/**
 * Shared CLI Types
 * Centralized type definitions for CLI commands and options
 * 
 * Note: Imports core workflow types to ensure consistency with AgentStateStore
 */

import { WorkflowSteps, StepStatus } from '@video-transcribe/core';

// CLI option interfaces
export interface TranscribeOptions {
  output: string;
  enhance: boolean;
  format: 'json' | 'txt' | 'both' | 'console';
  keepAudio: boolean;
  verbose: boolean;
  // Transcription service options
  useAzure: boolean;
  whisperModel?: string;
  whisperQuality?: string; 
  language?: string;
  fullyLocal: boolean;
  whisperCacheDir?: string;
}

export interface ResumeOptions {
  output: string;
  format: 'json' | 'txt' | 'both' | 'console';
  verbose: boolean;
  fromStep?: 'upload' | 'audio' | 'transcribe' | 'enhance';
}

export interface WhisperOptions {
  listModels?: boolean;
  download?: string;
  clearCache?: boolean;
  cacheInfo?: boolean;
  healthCheck?: boolean;
}

export interface ConfigOptions {
  showKeys: boolean;
}

// Re-export core workflow types for convenience  
export { WorkflowSteps, StepStatus };

// Workflow execution context (CLI-specific runtime info)
export interface WorkflowContext {
  workflowId: string;
  inputSource: string;
  options: TranscribeOptions;
  isUrl: boolean;
  startTime: number;
  // Reference to current state from AgentStateStore
  currentState?: { steps: WorkflowSteps };
}

// Resume context (CLI-specific resume logic)
export interface ResumeContext {
  workflowId: string;
  existingState: { steps: WorkflowSteps; original_options?: any; original_input?: string };
  originalOptions: Record<string, any>;
  originalInput: string;
  resumeFromStep: 'upload_video' | 'extract_audio' | 'transcribe_audio' | 'enhance_transcription' | 'completed';
}

// CLI step execution result (complements core WorkflowStep)
export interface CLIStepResult {
  stepName: keyof WorkflowSteps;
  success: boolean;
  processingTime: number;
  error?: string;
  // The actual result data that gets stored in AgentStateStore
  stateResult?: any;
}

// Progress reporter interface
export interface ProgressReporter {
  reportStep(step: number, total: number, title: string, details?: string): void;
  reportProgress(message: string, verbose?: boolean): void;
  reportSuccess(message: string, timing?: number): void;
  reportError(message: string, error?: Error): void;
  reportCompletion(workflowId: string, totalTime: number): void;
}

// Output formatter interface
export interface OutputFormatter {
  formatConsoleOutput(transcriptionResult: any, enhancementResult?: any): void;
  saveJsonOutput(data: any, outputPath: string): Promise<void>;
  saveTxtOutput(data: any, outputPath: string): Promise<void>;
}

// Command handler base interface
export interface CommandHandler {
  execute(...args: any[]): Promise<void>;
  validateOptions?(options: any): boolean;
  getDescription(): string;
}
