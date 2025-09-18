/**
 * Extract Audio Action - STATELESS VERSION
 * Takes video_url and workflow_id, extracts audio, updates agent state, cleans up video
 */

import { Request, Response } from 'express';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';
import { ServiceManager } from '../services/service-manager';
import { AudioExtractorService } from '../services/audio-extractor';

export class ExtractAudioStatelessAction {
  private static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  private static getReferenceService() {
    return ServiceManager.getInstance().getReferenceService();
  }

  private static audioExtractor = new AudioExtractorService();

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

      if (!state.video_url) {
        res.status(400).json({
          success: false,
          error: 'No video reference found in workflow state',
          next_action: 'Upload a video first using POST /upload-video with this workflow_id',
          workflow_id,
          current_state: {
            video_url: state.video_url,
            audio_url: state.audio_url,
            current_step: state.current_step
          }
        });
        return;
      }

      // Update state - mark current step
      await this.getStateStore().updateState(workflow_id, {
        current_step: 'extract-audio'
      });

      // Get video file from reference in state
      const video_url = state.video_url;
      const { stream: videoBuffer } = await this.getReferenceService().getFileStream(video_url);

      // Extract audio using temp file
      const tempVideoPath = this.getReferenceService().getFilePathFromUrl(video_url);
      const audioResult = await this.audioExtractor.extractAudioFromMp4(tempVideoPath);

      // Read extracted audio file
      const audioBuffer = await require('fs').promises.readFile(audioResult.audioFilePath);

      // Store audio by reference and generate reference identifier
      const audio_url = await this.getReferenceService().storeAudio(audioBuffer, workflow_id);
      const audio_reference = `audio_${workflow_id}_${Date.now()}`;

      // Clean up video reference (workflow cleanup)
      const cleanupResult = await this.getReferenceService().cleanup(video_url);

      // Clean up temporary audio file from extractor
      await this.audioExtractor.cleanup(audioResult.audioFilePath);

      // Update agent state with audio reference
      await this.getStateStore().updateState(workflow_id, {
        audio_url,
        current_step: 'extract-audio-completed'
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
      // Update state to mark failure
      try {
        const { workflow_id } = req.body;
        if (workflow_id) {
          await this.getStateStore().updateState(workflow_id, {
            status: 'failed',
            current_step: 'extract-audio-failed'
          });
        }
      } catch (stateError) {
        logger.error('Failed to update state on error:', stateError);
      }

      ApiResponseHandler.handleError(error, res, 'Extract audio (stateless)');
    }
  }
}
