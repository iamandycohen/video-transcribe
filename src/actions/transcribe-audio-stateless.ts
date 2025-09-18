/**
 * Transcribe Audio Action - STATELESS VERSION
 * Takes audio_url and workflow_id, transcribes to text, updates agent state, cleans up audio
 */

import { Request, Response } from 'express';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';
import { ServiceManager } from '../services/service-manager';
import { TranscribeAudioService } from '../services/transcribe-audio-service';

export class TranscribeAudioStatelessAction {
  private static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  private static getReferenceService() {
    return ServiceManager.getInstance().getReferenceService();
  }

  private static transcribeService = new TranscribeAudioService();

  /**
   * Handle transcribe audio request - stateless with workflow state
   * Input: { workflow_id: string }
   * Output: { success: boolean, raw_text: string, workflow_id: string, segments: array, cleanup: object }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { workflow_id } = req.body;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Transcribe audio requested: workflow_id=${workflow_id} by ${authMethod}`);

      // Get workflow state and verify audio reference exists
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

      if (!state.audio_url) {
        res.status(400).json({
          success: false,
          error: 'No audio reference found in workflow state',
          next_action: 'Extract audio first using POST /extract-audio with this workflow_id',
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
        current_step: 'transcribe-audio'
      });

      // Get audio file path from reference in state
      const audio_url = state.audio_url;
      const audioFilePath = this.getReferenceService().getFilePathFromUrl(audio_url);

      // Verify audio file exists
      const audioExists = await this.getReferenceService().exists(audio_url);
      if (!audioExists) {
        res.status(404).json({
          success: false,
          error: 'Audio file not found or expired',
          next_action: 'Extract audio again using POST /extract-audio with this workflow_id',
          workflow_id
        });
        return;
      }

      // Transcribe audio to text
      const transcriptionResult = await this.transcribeService.transcribeAudio({
        audioId: `audio_${workflow_id}`, // Dummy audioId for compatibility
        audioFilePath: audioFilePath
      });

      if (!transcriptionResult.success) {
        res.status(400).json({
          success: false,
          error: transcriptionResult.error,
          next_action: 'Check audio quality or try extracting audio again',
          workflow_id
        });
        return;
      }

      // Clean up audio reference (workflow cleanup)
      const cleanupResult = await this.getReferenceService().cleanup(audio_url);

      // Update agent state with transcription results
      await this.getStateStore().updateState(workflow_id, {
        raw_text: transcriptionResult.rawText,
        current_step: 'transcribe-audio-completed'
      });

      logger.info(`Audio transcribed successfully: workflow=${workflow_id}, text_length=${transcriptionResult.rawText?.length} by ${authMethod}`);
      
      res.json({
        success: true,
        raw_text: transcriptionResult.rawText,
        segments: transcriptionResult.segments,
        language: transcriptionResult.language,
        confidence: transcriptionResult.confidence,
        duration: transcriptionResult.duration,
        transcriptionTime: transcriptionResult.transcriptionTime,
        workflow_id,
        cleanup: cleanupResult,
        next_action: 'Enhance transcription using POST /enhance-transcription with this workflow_id, or proceed directly to analysis',
        message: 'Audio transcribed successfully. Audio file cleaned up. Text ready for enhancement or analysis.'
      });

    } catch (error) {
      // Update state to mark failure
      try {
        const { workflow_id } = req.body;
        if (workflow_id) {
          await this.getStateStore().updateState(workflow_id, {
            status: 'failed',
            current_step: 'transcribe-audio-failed'
          });
        }
      } catch (stateError) {
        logger.error('Failed to update state on error:', stateError);
      }

      ApiResponseHandler.handleError(error, res, 'Transcribe audio (stateless)');
    }
  }
}
