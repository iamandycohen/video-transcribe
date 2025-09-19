/**
 * Identify Topics Step - Handles AI-powered topic identification
 */

import { WorkflowStep } from '../base';

export interface IdentifyTopicsStep extends WorkflowStep {
  result?: {
    topics: string[];
    topics_count: number;
    processing_time: number;
    model_used: string;
  };
}
