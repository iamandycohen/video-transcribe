/**
 * Get Job Status Action - Retrieves job progress and results
 * Handles polling requests for background job status monitoring
 */

import { Request, Response } from 'express';
import { logger, ServiceManager } from '@video-transcribe/core';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';

export class GetJobStatusAction {
  private static getJobStore() {
    return ServiceManager.getInstance().getJobStateStore();
  }

  /**
   * Handle job status request
   * Input: { job_id } via URL params
   * Output: { success: boolean, job_id: string, status: string, progress: number, ... }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { job_id } = req.params;
      
      if (!job_id) {
        ApiResponseHandler.validationError(res, 'job_id is required');
        return;
      }

      // Validate job_id format
      if (!job_id.match(/^job_[a-fA-F0-9-]{36}$/)) {
        ApiResponseHandler.validationError(res, 'Invalid job ID format. Must be: job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.debug(`Job status requested: ${job_id} by ${authMethod}`);

      // Get job from store
      const job = await this.getJobStore().getJob(job_id);
      
      if (!job) {
        res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `No job found with ID: ${job_id}`,
          next_action: 'Verify the job_id or check if the job has been cleaned up'
        });
        return;
      }

      // Determine next action based on job status
      const next_action = this.getNextActionForStatus(job.status, job_id, job.operation);

      // Return job status
      res.json({
        success: true,
        job_id: job.job_id,
        workflow_id: job.workflow_id,
        operation: job.operation,
        status: job.status,
        progress: job.progress,
        message: job.message,
        created_at: job.created_at,
        started_at: job.started_at || null,
        completed_at: job.completed_at || null,
        cancelled_at: job.cancelled_at || null,
        estimated_completion: job.estimated_completion || null,
        result: job.result || null,
        error: job.error || null,
        next_action
      });

      // Log status check (only for completed/failed to avoid spam)
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        logger.info(`Job status retrieved: ${job_id} - ${job.status} by ${authMethod}`);
      }

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Get job status');
    }
  }

  /**
   * Generate appropriate next_action guidance based on job status
   */
  private static getNextActionForStatus(status: string, job_id: string, operation: string): string {
    switch (status) {
      case 'queued':
        return 'Continue polling every 2-3 seconds until job starts';
      
      case 'running':
        return 'Continue polling every 3 seconds until completion';
      
      case 'completed':
        switch (operation) {
          case 'upload_video':
            return 'Proceed to extract audio using POST /extract-audio with workflow_id';
          case 'extract_audio':
            return 'Proceed to transcribe audio using POST /transcribe-audio with workflow_id';
          case 'transcribe_audio':
            return 'Proceed to enhance transcription using POST /enhance-transcription with workflow_id';
          case 'enhance_transcription':
            return 'Check final results using GET /workflow/{workflow_id}';
          default:
            return 'Job completed successfully. Check workflow state for next steps.';
        }
      
      case 'failed':
        return 'Job failed. Check error details and retry if the error is retryable, or start a new job with corrected parameters.';
      
      case 'cancelled':
        return 'Job was cancelled. Start a new job if still needed.';
      
      default:
        return `Monitor job status by polling GET /jobs/${job_id}`;
    }
  }
}

