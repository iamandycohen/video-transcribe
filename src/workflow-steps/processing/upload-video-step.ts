/**
 * Upload Video Step - Handles video file uploads and storage
 */

import { WorkflowStep } from '../base';

export interface UploadVideoStep extends WorkflowStep {
  result?: {
    video_url: string;
    size: number;
    format: string;
    source_url?: string;
  };
}
