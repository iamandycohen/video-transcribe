/**
 * Upload Video Action - STATELESS VERSION
 * Takes workflow_id, stores video by reference, updates agent state
 */

import { Request, Response } from 'express';
import { logger, ServiceManager } from '@video-transcribe/core';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';

export class UploadVideoStatelessAction {
  private static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  private static getReferenceService() {
    return ServiceManager.getInstance().getReferenceService();
  }

  private static getJobStore() {
    return ServiceManager.getInstance().getJobStateStore();
  }

  /**
   * Handle video upload request - starts background job
   * Input: { source_url: string, workflow_id: string }
   * Output: { success: boolean, job_id: string, workflow_id: string, status: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { source_url, workflow_id } = req.body;
      
      if (!source_url) {
        ApiResponseHandler.validationError(res, 'source_url is required');
        return;
      }

      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Upload video job requested: ${source_url} for workflow ${workflow_id} by ${authMethod}`);

      // Create job in JobStateStore
      const job_id = await this.getJobStore().createJob({
        workflow_id,
        operation: 'upload_video',
        input_params: { source_url, workflow_id }
      });

      // Start the upload step in workflow
      await this.getStateStore().startStep(workflow_id, 'upload_video');

      // Return job_id immediately (202 Accepted)
      res.status(202).json({
        success: true,
        job_id,
        status: 'queued',
        progress: 0,
        message: 'Video upload job started',
        workflow_id,
        next_action: `Poll GET /jobs/${job_id} every 2-5 seconds for progress and completion`
      });

      // Execute the job in background
      this.executeUploadJob(job_id, workflow_id, source_url);

    } catch (error) {
      // Handle immediate errors (before job creation)
      ApiResponseHandler.handleError(error, res, 'Upload video job creation');
    }
  }

  /**
   * Execute the video upload job in background
   */
  private static async executeUploadJob(job_id: string, workflow_id: string, source_url: string): Promise<void> {
    try {
      // Update job status to running
      await this.getJobStore().updateJobStatus(job_id, 'running', 'Starting video download...');

      // Check for cancellation
      const cancellationToken = this.getJobStore().getCancellationToken(job_id);
      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled', 'Job was cancelled before download started');
        return;
      }

      // Download and store video by reference with progress
      const progressCallback = (downloaded: number, total: number, percentage: number) => {
        if (cancellationToken?.aborted) return;
        const message = total > 0 
          ? `Downloaded ${Math.round(downloaded / 1024 / 1024)}MB of ${Math.round(total / 1024 / 1024)}MB (${percentage}%)`
          : `Downloaded ${Math.round(downloaded / 1024 / 1024)}MB`;
        
        // Update job progress asynchronously
        this.getJobStore().updateJobProgress(job_id, { 
          progress: percentage, 
          message 
        }).catch((error: any) => {
          logger.warn('Failed to update job progress', { job_id, error: error.message });
        });
      };

      const video_url = await this.getReferenceService().storeFromUrlWithProgress(
        source_url, 
        workflow_id,
        progressCallback,
        cancellationToken || undefined
      );

      // Check for cancellation after download
      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled', 'Job was cancelled during download');
        await this.getStateStore().failStep(workflow_id, 'upload_video', {
          message: 'Upload cancelled by user',
          code: 'UPLOAD_CANCELLED'
        });
        return;
      }

      // Get file info for result
      const fileInfo = await this.getReferenceService().getFileInfo(video_url);
      const video_reference = `video_${workflow_id}_${Date.now()}`;
      
      // Complete upload step with results
      const stepResult = {
        video_url,
        size: fileInfo?.size || 0,
        format: source_url.split('.').pop()?.toLowerCase() || 'mp4',
        source_url
      };

      await this.getStateStore().completeStep(workflow_id, 'upload_video', stepResult);

      // Complete the job with results
      await this.getJobStore().setJobResult(job_id, {
        video_url,
        reference_id: video_reference,
        file_info: {
          size: fileInfo?.size || 0,
          contentType: `video/${stepResult.format}`
        }
      });

      logger.info(`Video upload job completed: job=${job_id}, workflow=${workflow_id}`);

    } catch (error: any) {
      logger.error(`Video upload job failed: job=${job_id}, workflow=${workflow_id}`, { error: error?.message || 'Unknown error' });

      // Set job error
      await this.getJobStore().setJobError(job_id, {
        code: 'UPLOAD_FAILED',
        message: error?.message || 'Unknown upload error',
        retryable: true,
        retry_after: 60,
        details: error
      });

      // Fail the workflow step
      await this.getStateStore().failStep(workflow_id, 'upload_video', {
        message: error?.message || 'Unknown upload error',
        code: 'UPLOAD_FAILED',
        details: error
      });
    }
  }

  /**
   * Create new workflow endpoint
   * Output: { success: boolean, workflow_id: string }
   */
  static async createWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Create workflow requested by ${authMethod}`);

      const workflow_id = await this.getStateStore().createWorkflow();

      res.json({
        success: true,
        workflow_id,
        message: 'Workflow created successfully. Use workflow_id for all subsequent operations.'
      });

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Create workflow');
    }
  }

  /**
   * Get workflow state endpoint
   * Input: { workflow_id: string }
   * Output: { success: boolean, state: AgentState }
   */
  static async getWorkflowState(req: Request, res: Response): Promise<void> {
    try {
      const { workflow_id } = req.params;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const state = await this.getStateStore().getState(workflow_id);
      
      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      res.json({
        success: true,
        state,
        message: 'Workflow state retrieved successfully.'
      });

    } catch (error) {
      ApiResponseHandler.handleError(error, res, 'Get workflow state');
    }
  }
}
