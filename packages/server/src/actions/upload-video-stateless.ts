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

  /**
   * Handle video upload request - stateless with workflow_id
   * Input: { source_url: string, workflow_id?: string }
   * Output: { success: boolean, video_reference: string, workflow_id: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { source_url, workflow_id } = req.body;
      
      if (!source_url) {
        ApiResponseHandler.validationError(res, 'source_url is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Upload video requested: ${source_url} by ${authMethod}`);

      // Create or use existing workflow
      const workflowId = workflow_id || await this.getStateStore().createWorkflow();
      
      // Start upload step
      await this.getStateStore().startStep(workflowId, 'upload_video');

      // Download and store video by reference
      const video_url = await this.getReferenceService().storeFromUrl(source_url, workflowId);
      const video_reference = `video_${workflowId}_${Date.now()}`;

      // Get file info for result
      const fileInfo = await this.getReferenceService().getFileInfo(video_url);
      
      // Complete upload step with results
      await this.getStateStore().completeStep(workflowId, 'upload_video', {
        video_url,
        size: fileInfo?.size || 0,
        format: source_url.split('.').pop()?.toLowerCase() || 'mp4',
        source_url
      });

      logger.info(`Video uploaded successfully: workflow=${workflowId}, video_reference=${video_reference} by ${authMethod}`);
      
      res.json({
        success: true,
        video_reference,
        workflow_id: workflowId,
        next_action: 'Extract audio using POST /extract-audio with this workflow_id',
        message: 'Video uploaded successfully. Video ready for audio extraction.'
      });

    } catch (error) {
      // Fail the upload step if workflow exists
      try {
        const { workflow_id } = req.body;
        if (workflow_id) {
          await this.getStateStore().failStep(workflow_id, 'upload_video', {
            message: error instanceof Error ? error.message : 'Unknown upload error',
            code: 'UPLOAD_FAILED',
            details: error
          });
        }
      } catch (stateError) {
        logger.error('Failed to update state on upload error:', stateError);
      }

      ApiResponseHandler.handleError(error, res, 'Upload video (stateless)');
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
