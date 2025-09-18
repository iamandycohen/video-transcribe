/**
 * Enhance Transcription Action - STATELESS VERSION
 * Takes raw_text and workflow_id, enhances with GPT, updates agent state
 */

import { Request, Response } from 'express';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';
import { logger } from '../utils/logger';
import { ServiceManager } from '../services/service-manager';
import { EnhanceTranscriptionService } from '../services/enhance-transcription-service';

export class EnhanceTranscriptionStatelessAction {
  private static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  private static enhanceService: EnhanceTranscriptionService | null = null;

  private static getService(): EnhanceTranscriptionService {
    if (!this.enhanceService) {
      this.enhanceService = new EnhanceTranscriptionService();
    }
    return this.enhanceService;
  }

  /**
   * Handle enhance transcription request - stateless with workflow state
   * Input: { raw_text?: string, workflow_id: string }
   * Output: { success: boolean, enhanced_text: string, workflow_id: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { raw_text, workflow_id } = req.body;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Enhance transcription requested: workflow_id=${workflow_id} by ${authMethod}`);

      // Get workflow state
      const state = await this.getStateStore().getState(workflow_id);
      if (!state) {
        res.status(404).json({
          success: false,
          error: 'Workflow not found'
        });
        return;
      }

      // Use provided raw_text or get from state
      const textToEnhance = raw_text || state.raw_text;
      
      if (!textToEnhance) {
        ApiResponseHandler.validationError(res, 'raw_text is required (either in request or workflow state)');
        return;
      }

      // Update state - mark current step
      await this.getStateStore().updateState(workflow_id, {
        current_step: 'enhance-transcription'
      });

      // Enhance transcription with GPT
      const enhancementResult = await this.getService().enhanceTranscription({
        text: textToEnhance
      });

      if (!enhancementResult.success) {
        res.status(400).json({
          success: false,
          error: enhancementResult.error,
          workflow_id
        });
        return;
      }

      // Update agent state with enhanced text
      await this.getStateStore().updateState(workflow_id, {
        enhanced_text: enhancementResult.enhancedText,
        current_step: 'enhance-transcription-completed'
      });

      logger.info(`Transcription enhanced successfully: workflow=${workflow_id}, enhanced_length=${enhancementResult.enhancedText?.length} by ${authMethod}`);
      
      res.json({
        success: true,
        enhanced_text: enhancementResult.enhancedText,
        original_text: textToEnhance,
        enhancementTime: enhancementResult.enhancementTime,
        workflow_id,
        message: 'Transcription enhanced successfully. Use enhanced_text and workflow_id for further analysis.'
      });

    } catch (error) {
      // Update state to mark failure
      try {
        const { workflow_id } = req.body;
        if (workflow_id) {
          await this.getStateStore().updateState(workflow_id, {
            status: 'failed',
            current_step: 'enhance-transcription-failed'
          });
        }
      } catch (stateError) {
        logger.error('Failed to update state on error:', stateError);
      }

      ApiResponseHandler.handleError(error, res, 'Enhance transcription (stateless)');
    }
  }
}
