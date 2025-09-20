/**
 * Extract Audio Action - STATELESS VERSION
 * Takes video_url and workflow_id, extracts audio, updates agent state, cleans up video
 */

import { Request, Response } from 'express';
import { logger, ServiceManager } from '@video-transcribe/core';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';

export class ExtractAudioStatelessAction {
  private static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  private static getReferenceService() {
    return ServiceManager.getInstance().getReferenceService();
  }

  private static getAudioExtractor() {
    return ServiceManager.getInstance().getAudioExtractorService();
  }

  private static getJobStore() {
    return ServiceManager.getInstance().getJobStateStore();
  }

  /**
   * Handle extract audio request - starts background job
   * Input: { workflow_id: string }
   * Output: { success: boolean, job_id: string, workflow_id: string, status: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { workflow_id } = req.body;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Extract audio job requested: workflow_id=${workflow_id} by ${authMethod}`);

      // Create job in JobStateStore
      const job_id = await this.getJobStore().createJob({
        workflow_id,
        operation: 'extract_audio',
        input_params: { workflow_id }
      });

      // Start the extract audio step in workflow
      await this.getStateStore().startStep(workflow_id, 'extract_audio');

      // Return job_id immediately (202 Accepted)
      res.status(202).json({
        success: true,
        job_id,
        status: 'queued',
        progress: 0,
        message: 'Audio extraction job started',
        workflow_id,
        next_action: `Poll GET /jobs/${job_id} every 2-5 seconds for progress and completion`
      });

      // Execute the job in background
      this.executeExtractionJob(job_id, workflow_id);

    } catch (error) {
      // Handle immediate errors (before job creation)
      ApiResponseHandler.handleError(error, res, 'Extract audio job creation');
    }
  }

  /**
   * Execute audio extraction job in background
   */
  private static async executeExtractionJob(job_id: string, workflow_id: string): Promise<void> {
    const cancellationToken = this.getJobStore().getCancellationToken(job_id);
    
    try {
      // Update job status to running
      await this.getJobStore().updateJobStatus(job_id, 'running');
      await this.getJobStore().updateJobProgress(job_id, 10, 'Checking workflow state...');

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      // Get workflow state and verify video reference exists
      const state = await this.getStateStore().getState(workflow_id);
      if (!state) {
        await this.getJobStore().setJobError(job_id, {
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Workflow not found',
          retryable: false
        });
        await this.getStateStore().failStep(workflow_id, 'extract_audio', {
          message: 'Workflow not found',
          code: 'WORKFLOW_NOT_FOUND'
        });
        return;
      }

      // Check if upload_video step was completed
      const uploadResult = this.getStateStore().getStepResult(state, 'upload_video');
      if (!uploadResult || !uploadResult.video_url) {
        await this.getJobStore().setJobError(job_id, {
          code: 'NO_VIDEO_REFERENCE',
          message: 'No video reference found in workflow state. Upload video first.',
          retryable: false
        });
        await this.getStateStore().failStep(workflow_id, 'extract_audio', {
          message: 'No video reference found',
          code: 'NO_VIDEO_REFERENCE'
        });
        return;
      }

      await this.getJobStore().updateJobProgress(job_id, 30, 'Starting audio extraction...');

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      // Get video file from upload step result
      const video_url = uploadResult.video_url;

      // Extract audio using temp file
      const tempVideoPath = this.getReferenceService().getFilePathFromUrl(video_url);
      
      await this.getJobStore().updateJobProgress(job_id, 50, 'Extracting audio from video...');
      
      const audioResult = await this.getAudioExtractor().extractAudioFromMp4(tempVideoPath);

      if (cancellationToken?.aborted) {
        await this.getAudioExtractor().cleanup(audioResult.audioFilePath);
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      await this.getJobStore().updateJobProgress(job_id, 70, 'Processing extracted audio...');

      // Read extracted audio file
      const audioBuffer = await require('fs').promises.readFile(audioResult.audioFilePath);

      // Store audio by reference and generate reference identifier
      const audio_url = await this.getReferenceService().storeAudio(audioBuffer, workflow_id);
      const audio_reference = `audio_${workflow_id}_${Date.now()}`;

      await this.getJobStore().updateJobProgress(job_id, 85, 'Cleaning up video file...');

      // Clean up video reference (workflow cleanup)
      const cleanupResult = await this.getReferenceService().cleanup(video_url);

      // Clean up temporary audio file from extractor
      await this.getAudioExtractor().cleanup(audioResult.audioFilePath);

      // Get audio file info for result
      const audioFileInfo = await this.getReferenceService().getFileInfo(audio_url);

      await this.getJobStore().updateJobProgress(job_id, 95, 'Finalizing extraction...');

      // Complete extract audio step with results
      const stepResult = {
        audio_url,
        extraction_time: 0, // Duration would need to be calculated separately if needed
        video_cleaned: cleanupResult.success,
        audio_size: audioFileInfo?.size || 0
      };

      await this.getStateStore().completeStep(workflow_id, 'extract_audio', stepResult);

      // Complete the job
      await this.getJobStore().setJobResult(job_id, {
        audio_reference,
        workflow_id,
        cleanup: cleanupResult,
        next_action: 'Transcribe the audio using POST /transcribe-audio with this workflow_id',
        message: 'Audio extracted successfully. Video file cleaned up. Audio ready for transcription.'
      });

      await this.getJobStore().updateJobStatus(job_id, 'completed');

      logger.info(`Audio extracted successfully: workflow=${workflow_id}, audio_reference=${audio_reference}, job=${job_id}`);

    } catch (error: any) {
      // Fail the job and workflow step
      await this.getJobStore().setJobError(job_id, {
        code: 'EXTRACT_AUDIO_FAILED',
        message: error?.message || 'Unknown extraction error',
        retryable: true,
        retry_after: 30000
      });

      await this.getStateStore().failStep(workflow_id, 'extract_audio', {
        message: error?.message || 'Unknown extraction error',
        code: 'EXTRACT_AUDIO_FAILED',
        details: error
      });

      logger.error(`Audio extraction failed: workflow=${workflow_id}, job=${job_id}, error=${error?.message}`);
    }
  }
}
