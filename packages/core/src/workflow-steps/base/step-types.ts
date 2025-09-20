/**
 * Base workflow step types and interfaces
 */

// Step status types
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// Error information for failed steps
export interface StepError {
  message: string;
  code?: string;
  details?: unknown;
}

// Base step interface that all workflow steps extend
export interface WorkflowStep {
  status: StepStatus;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error?: StepError;
  processing_time?: number; // milliseconds
}
