/**
 * Summarize Content Step - Handles AI-powered content summarization
 */

import { WorkflowStep } from '../base';

export interface SummarizeContentStep extends WorkflowStep {
  result?: {
    summary: string;
    summary_length: number;
    processing_time: number;
    model_used: string;
  };
}
