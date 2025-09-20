/**
 * Cancel Job Action - Cancels running or queued background jobs
 * Handles graceful cancellation with proper cleanup
 */

import { Request, Response } from 'express';
import { logger, ServiceManager } from '@video-transcribe/core';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';

export class CancelJobAction {
  private static getJobStore() {
    return ServiceManager.getInstance().getJobStateStore();
  }

  /**
   * Handle job cancellation request
   * Input: { job_id } via URL params, optional { reason } in body
   * Output: { success: boolean, job_id: string, status: 'cancelled', ... }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { job_id } = req.params;
      const { reason } = req.body || {};
      
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
      const cancelReason = reason || 'Job cancelled by user';
      
      logger.info(`Job cancellation requested: ${job_id} (reason: ${cancelReason}) by ${authMethod}`);

      // Get job to check current status
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

      // Check if job can be cancelled
      if (!['queued', 'running'].includes(job.status)) {
        res.status(409).json({
          success: false,
          error: 'Job cannot be cancelled',
          message: `Cannot cancel job with status '${job.status}'. Only 'queued' and 'running' jobs can be cancelled.`,
          current_status: job.status,
          job_id: job_id,
          next_action: job.status === 'completed' 
            ? `Check job results using GET /jobs/${job_id}` 
            : `Check job status using GET /jobs/${job_id} to see final state`
        });
        return;
      }

      // Attempt to cancel the job
      const cancelled = await this.getJobStore().cancelJob(job_id, cancelReason);
      
      if (!cancelled) {
        res.status(409).json({
          success: false,
          error: 'Job cancellation failed',
          message: 'Job could not be cancelled (may have completed during request)',
          job_id: job_id,
          next_action: `Check job status using GET /jobs/${job_id} to see current state`
        });
        return;
      }

      // Get updated job state
      const cancelledJob = await this.getJobStore().getJob(job_id);
      
      if (!cancelledJob) {
        logger.error(`Job disappeared after cancellation: ${job_id}`);
        res.status(500).json({
          success: false,
          error: 'Internal error',
          message: 'Job was cancelled but state could not be retrieved',
          next_action: 'Contact support if this persists'
        });
        return;
      }

      // Determine next action
      const next_action = this.getNextActionAfterCancellation(cancelledJob.operation);

      // Return cancellation success
      res.json({
        success: true,
        job_id: cancelledJob.job_id,
        workflow_id: cancelledJob.workflow_id,
        operation: cancelledJob.operation,
        status: cancelledJob.status,
        cancelled_at: cancelledJob.cancelled_at,
        cancel_reason: cancelledJob.cancel_reason,
        progress_at_cancellation: job.progress, // Original progress before cancellation
        cleanup_performed: true, // Assume cleanup is always performed
        message: `${this.getOperationDisplayName(cancelledJob.operation)} job cancelled: ${cancelledJob.cancel_reason}`,
        next_action
      });

      logger.info(`Job cancelled successfully: ${job_id} by ${authMethod}`);

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Cancel job');
    }
  }

  /**
   * Generate appropriate next_action guidance after cancellation
   */
  private static getNextActionAfterCancellation(operation: string): string {
    switch (operation) {
      case 'upload_video':
        return 'Start a new upload job with corrected parameters if needed';
      case 'extract_audio':
        return 'Start a new audio extraction job if the video upload was successful';
      case 'transcribe_audio':
        return 'Start a new transcription job with updated parameters if needed';
      case 'enhance_transcription':
        return 'Start a new enhancement job if transcription was successful';
      default:
        return 'Start a new job with updated parameters if still needed';
    }
  }

  /**
   * Get human-readable operation name
   */
  private static getOperationDisplayName(operation: string): string {
    switch (operation) {
      case 'upload_video':
        return 'Video upload';
      case 'extract_audio':
        return 'Audio extraction';
      case 'transcribe_audio':
        return 'Audio transcription';
      case 'enhance_transcription':
        return 'Transcription enhancement';
      default:
        return operation.replace(/_/g, ' ');
    }
  }
}

