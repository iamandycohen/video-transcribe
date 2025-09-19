/**
 * Extract Key Points Step - Handles AI-powered key points extraction
 */

import { WorkflowStep } from '../base';

export interface ExtractKeyPointsStep extends WorkflowStep {
  result?: {
    key_points: string[];
    points_count: number;
    processing_time: number;
    model_used: string;
  };
}
