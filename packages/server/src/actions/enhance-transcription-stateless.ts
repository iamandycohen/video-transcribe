/**
 * Enhance Transcription Action - STATELESS VERSION
 * Takes raw_text and workflow_id, enhances with GPT, updates agent state
 */

import { Request, Response } from 'express';
import { logger, ServiceManager, azureConfig } from '@video-transcribe/core';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';

export class EnhanceTranscriptionStatelessAction {
  private static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  private static getEnhanceService() {
    return ServiceManager.getInstance().getGPTEnhancementService();
  }

  private static getJobStore() {
    return ServiceManager.getInstance().getJobStateStore();
  }

  /**
   * Handle enhance transcription request - starts background job
   * Input: { raw_text?: string, workflow_id: string }
   * Output: { success: boolean, job_id: string, workflow_id: string, status: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { raw_text, workflow_id } = req.body;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Enhance transcription job requested: workflow_id=${workflow_id} by ${authMethod}`);

      // Create job in JobStateStore
      const job_id = await this.getJobStore().createJob({
        workflow_id,
        operation: 'enhance_transcription',
        input_params: { raw_text, workflow_id }
      });

      // Start the enhance transcription step in workflow
      await this.getStateStore().startStep(workflow_id, 'enhance_transcription');

      // Return job_id immediately (202 Accepted)
      res.status(202).json({
        success: true,
        job_id,
        status: 'queued',
        progress: 0,
        message: 'Transcription enhancement job started',
        workflow_id,
        next_action: `Poll GET /jobs/${job_id} every 2-5 seconds for progress and completion`
      });

      // Execute the job in background
      this.executeEnhancementJob(job_id, workflow_id, raw_text);

    } catch (error) {
      // Handle immediate errors (before job creation)
      ApiResponseHandler.handleError(error, res, 'Enhance transcription job creation');
    }
  }

  /**
   * Execute enhancement job in background
   */
  private static async executeEnhancementJob(job_id: string, workflow_id: string, raw_text?: string): Promise<void> {
    const cancellationToken = this.getJobStore().getCancellationToken(job_id);
    
    try {
      // Update job status to running
      await this.getJobStore().updateJobStatus(job_id, 'running');
      await this.getJobStore().updateJobProgress(job_id, { progress: 10, message: 'Checking workflow state...' });

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      // Get workflow state
      const state = await this.getStateStore().getState(workflow_id);
      if (!state) {
        await this.getJobStore().setJobError(job_id, {
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Workflow not found',
          retryable: false
        });
        await this.getStateStore().failStep(workflow_id, 'enhance_transcription', {
          message: 'Workflow not found',
          code: 'WORKFLOW_NOT_FOUND'
        });
        return;
      }

      // Use provided raw_text or get from state
      // Get text from transcribe_audio step result
      const transcribeResult = this.getStateStore().getStepResult(state, 'transcribe_audio');
      const textToEnhance = raw_text || transcribeResult?.raw_text;
      
      if (!textToEnhance) {
        await this.getJobStore().setJobError(job_id, {
          code: 'NO_TEXT_TO_ENHANCE',
          message: 'No text found to enhance. Transcribe audio first or provide raw_text.',
          retryable: false
        });
        await this.getStateStore().failStep(workflow_id, 'enhance_transcription', {
          message: 'No text found to enhance',
          code: 'NO_TEXT_TO_ENHANCE'
        });
        return;
      }

      await this.getJobStore().updateJobProgress(job_id, { progress: 30, message: 'Starting GPT enhancement...' });

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      await this.getJobStore().updateJobProgress(job_id, { progress: 50, message: 'Processing with GPT-4o...' });

      // Enhance transcription with GPT
      const enhancementResult = await this.getEnhanceService().enhanceTranscription({
        fullText: textToEnhance,
        segments: [],
        duration: 0,
        language: 'en-US',
        confidence: 1.0
      });

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      await this.getJobStore().updateJobProgress(job_id, { progress: 90, message: 'Finalizing enhancement...' });

      // Complete enhance transcription step with results
      const stepResult = {
        enhanced_text: enhancementResult.enhancedText,
        summary: enhancementResult.summary,
        key_points: enhancementResult.keyPoints,
        topics: enhancementResult.topics,
        sentiment: enhancementResult.sentiment,
        enhancement_time: 0,
        model_used: azureConfig.models.gptTranscribe
      };

      await this.getStateStore().completeStep(workflow_id, 'enhance_transcription', stepResult);

      // Complete the job
      await this.getJobStore().setJobResult(job_id, {
        enhanced_text: enhancementResult.enhancedText,
        summary: enhancementResult.summary,
        key_points: enhancementResult.keyPoints,
        topics: enhancementResult.topics,
        sentiment: enhancementResult.sentiment,
        original_text: textToEnhance,
        workflow_id,
        message: 'Transcription enhanced successfully. Use enhanced_text and workflow_id for further analysis.'
      });

      await this.getJobStore().updateJobStatus(job_id, 'completed');

      logger.info(`Transcription enhanced successfully: workflow=${workflow_id}, enhanced_length=${enhancementResult.enhancedText?.length}, job=${job_id}`);

    } catch (error: any) {
      // Fail the job and workflow step
      await this.getJobStore().setJobError(job_id, {
        code: 'ENHANCE_TRANSCRIPTION_FAILED',
        message: error?.message || 'Unknown enhancement error',
        retryable: true,
        retry_after: 30000
      });

      await this.getStateStore().failStep(workflow_id, 'enhance_transcription', {
        message: error?.message || 'Unknown enhancement error',
        code: 'ENHANCE_TRANSCRIPTION_FAILED',
        details: error
      });

      logger.error(`Transcription enhancement failed: workflow=${workflow_id}, job=${job_id}, error=${error?.message}`);
    }
  }
}
