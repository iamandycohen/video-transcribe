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

  /**
   * Handle extract audio request - stateless with workflow state
   * Input: { workflow_id: string }
   * Output: { success: boolean, audio_reference: string, workflow_id: string, cleanup: object }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { workflow_id } = req.body;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Extract audio requested: workflow_id=${workflow_id} by ${authMethod}`);

      // Get workflow state and verify video reference exists
      const state = await this.getStateStore().getState(workflow_id);
      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found',
          next_action: 'Create a workflow first using POST /workflow',
          workflow_id
        });
        return;
      }

      // Check if upload_video step was completed
      const uploadResult = this.getStateStore().getStepResult(state, 'upload_video');
      if (!uploadResult || !uploadResult.video_url) {
        res.status(400).json({
          success: false,
          error: 'No video reference found in workflow state',
          next_action: 'Upload a video first using POST /upload-video with this workflow_id',
          workflow_id,
          current_state: {
            upload_video_status: this.getStateStore().getStepStatus(state, 'upload_video'),
            extract_audio_status: this.getStateStore().getStepStatus(state, 'extract_audio')
          }
        });
        return;
      }

      // Start extract audio step
      await this.getStateStore().startStep(workflow_id, 'extract_audio');

      // Get video file from upload step result
      const video_url = uploadResult.video_url;

      // Extract audio using temp file
      const tempVideoPath = this.getReferenceService().getFilePathFromUrl(video_url);
      const audioResult = await this.getAudioExtractor().extractAudioFromMp4(tempVideoPath);

      // Read extracted audio file
      const audioBuffer = await require('fs').promises.readFile(audioResult.audioFilePath);

      // Store audio by reference and generate reference identifier
      const audio_url = await this.getReferenceService().storeAudio(audioBuffer, workflow_id);
      const audio_reference = `audio_${workflow_id}_${Date.now()}`;

      // Clean up video reference (workflow cleanup)
      const cleanupResult = await this.getReferenceService().cleanup(video_url);

      // Clean up temporary audio file from extractor
      await this.getAudioExtractor().cleanup(audioResult.audioFilePath);

      // Get audio file info for result
      const audioFileInfo = await this.getReferenceService().getFileInfo(audio_url);

      // Complete extract audio step with results
      await this.getStateStore().completeStep(workflow_id, 'extract_audio', {
        audio_url,
        extraction_time: 0, // Duration would need to be calculated separately if needed
        video_cleaned: cleanupResult.success,
        audio_size: audioFileInfo?.size || 0
      });

      logger.info(`Audio extracted successfully: workflow=${workflow_id}, audio_reference=${audio_reference} by ${authMethod}`);
      
      res.json({
        success: true,
        audio_reference,
        workflow_id,
        cleanup: cleanupResult,
        next_action: 'Transcribe the audio using POST /transcribe-audio with this workflow_id',
        message: 'Audio extracted successfully. Video file cleaned up. Audio ready for transcription.'
      });

    } catch (error) {
      // Fail the extract audio step
      try {
        const { workflow_id } = req.body;
        if (workflow_id) {
          await this.getStateStore().failStep(workflow_id, 'extract_audio', {
            message: error instanceof Error ? error.message : 'Unknown extraction error',
            code: 'EXTRACT_AUDIO_FAILED',
            details: error
          });
        }
      } catch (stateError) {
        logger.error('Failed to update state on error:', stateError);
      }

      ApiResponseHandler.handleError(error, res, 'Extract audio (stateless)');
    }
  }
}
