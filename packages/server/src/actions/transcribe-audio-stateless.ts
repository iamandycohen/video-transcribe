/**
 * Transcribe Audio Action - STATELESS VERSION
 * Takes audio_url and workflow_id, transcribes to text, updates agent state, cleans up audio
 */

import { Request, Response } from 'express';
import { logger, ServiceManager } from '@video-transcribe/core';
import { ApiResponseHandler } from '../lib/responses/api-responses';
import { AuthUtils } from '../lib/auth/auth-utils';

export class TranscribeAudioStatelessAction {
  private static getStateStore() {
    return ServiceManager.getInstance().getAgentStateStore();
  }

  private static getReferenceService() {
    return ServiceManager.getInstance().getReferenceService();
  }

  private static getTranscribeService() {
    return ServiceManager.getInstance().getTranscribeAudioService();
  }

  private static getWhisperService() {
    return ServiceManager.getInstance().getWhisperService();
  }

  private static getJobStore() {
    return ServiceManager.getInstance().getJobStateStore();
  }

  /**
   * Handle transcribe audio request - starts background job
   * Input: { 
   *   workflow_id: string, 
   *   quality?: "fast"|"balanced"|"accurate"|"best" (defaults to "balanced"),
   *   language?: string,
   *   use_azure?: boolean (defaults to false - whisper is default)
   * }
   * Output: { success: boolean, job_id: string, workflow_id: string, status: string }
   */
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const { 
        workflow_id, 
        quality = "balanced",
        language,
        use_azure = false  // Whisper is now the default
      } = req.body;
      
      if (!workflow_id) {
        ApiResponseHandler.validationError(res, 'workflow_id is required');
        return;
      }

      const authMethod = AuthUtils.getAuthMethod(req);
      logger.info(`Transcribe audio job requested: workflow_id=${workflow_id}, quality=${quality}, use_azure=${use_azure} by ${authMethod}`);

      // Create job in JobStateStore
      const job_id = await this.getJobStore().createJob({
        workflow_id,
        operation: 'transcribe_audio',
        input_params: { workflow_id, quality, language, use_azure }
      });

      // Start the transcribe audio step in workflow
      await this.getStateStore().startStep(workflow_id, 'transcribe_audio');

      // Return job_id immediately (202 Accepted)
      res.status(202).json({
        success: true,
        job_id,
        status: 'queued',
        progress: 0,
        message: 'Audio transcription job started',
        workflow_id,
        next_action: `Poll GET /jobs/${job_id} every 2-5 seconds for progress and completion`
      });

      // Execute the job in background
      this.executeTranscriptionJob(job_id, workflow_id, quality, language, use_azure);

    } catch (error) {
      // Handle immediate errors (before job creation)
      ApiResponseHandler.handleError(error, res, 'Transcribe audio job creation');
    }
  }

  /**
   * Execute transcription job in background
   */
  private static async executeTranscriptionJob(
    job_id: string, 
    workflow_id: string, 
    quality: string, 
    language?: string, 
    use_azure: boolean = false
  ): Promise<void> {
    const cancellationToken = this.getJobStore().getCancellationToken(job_id);
    
    try {
      // Update job status to running
      await this.getJobStore().updateJobStatus(job_id, 'running');
      await this.getJobStore().updateJobProgress(job_id, 10, 'Checking workflow state...');

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      // Get workflow state and verify audio reference exists
      const state = await this.getStateStore().getState(workflow_id);
      if (!state) {
        await this.getJobStore().setJobError(job_id, {
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Workflow not found',
          retryable: false
        });
        await this.getStateStore().failStep(workflow_id, 'transcribe_audio', {
          message: 'Workflow not found',
          code: 'WORKFLOW_NOT_FOUND'
        });
        return;
      }

      // Check if extract_audio step was completed
      const extractResult = this.getStateStore().getStepResult(state, 'extract_audio');
      if (!extractResult || !extractResult.audio_url) {
        await this.getJobStore().setJobError(job_id, {
          code: 'NO_AUDIO_REFERENCE',
          message: 'No audio reference found in workflow state. Extract audio first.',
          retryable: false
        });
        await this.getStateStore().failStep(workflow_id, 'transcribe_audio', {
          message: 'No audio reference found',
          code: 'NO_AUDIO_REFERENCE'
        });
        return;
      }

      // Get audio file path from extract step result
      const audio_url = extractResult.audio_url;
      const audioFilePath = this.getReferenceService().getFilePathFromUrl(audio_url);

      // Verify audio file exists
      const audioExists = await this.getReferenceService().exists(audio_url);
      if (!audioExists) {
        await this.getJobStore().setJobError(job_id, {
          code: 'AUDIO_FILE_NOT_FOUND',
          message: 'Audio file not found or expired. Extract audio again.',
          retryable: false
        });
        await this.getStateStore().failStep(workflow_id, 'transcribe_audio', {
          message: 'Audio file not found or expired',
          code: 'AUDIO_FILE_NOT_FOUND'
        });
        return;
      }

      await this.getJobStore().updateJobProgress(job_id, 30, 'Starting transcription...');

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      // Transcribe audio to text (Whisper first, Azure fallback)
      let transcriptionResult: any;
      let serviceUsed = 'whisper';
      
      if (use_azure) {
        // Explicitly requested Azure Speech Services
        await this.getJobStore().updateJobProgress(job_id, 50, 'Transcribing with Azure Speech Services...');
        serviceUsed = 'azure';
        transcriptionResult = await this.getTranscribeService().transcribeAudio({
          audioId: `audio_${workflow_id}`, // Dummy audioId for compatibility
          audioFilePath: audioFilePath
        });
      } else {
        // Use local Whisper (default) with auto-fallback to Azure
        try {
          await this.getJobStore().updateJobProgress(job_id, 50, `Transcribing with Whisper (${quality} model)...`);
          
          const whisperService = this.getWhisperService();
          
          const whisperOptions = {
            quality: quality as any,
            language: language,
            verbose: false
          };
          
          const whisperResult = await whisperService.transcribeAudio(
            audioFilePath, 
            whisperOptions,
            // Progress callback for model downloads and transcription
            (progress) => {
              logger.info(`Whisper: ${progress.message}`);
              // Update job progress based on Whisper progress
              if (progress.type === 'download') {
                this.getJobStore().updateJobProgress(job_id, 40 + (progress.progress * 0.1), `Downloading ${quality} model: ${progress.progress}%`);
              } else if (progress.type === 'transcription') {
                this.getJobStore().updateJobProgress(job_id, 50 + (progress.progress * 0.3), `Transcribing: ${progress.progress}%`);
              }
            }
          );
          
          // Convert Whisper result to expected format
          transcriptionResult = {
            success: true,
            rawText: whisperResult.text,
            confidence: null, // Whisper doesn't provide confidence scores
            language: whisperResult.language,
            segments: whisperResult.segments,
            duration: whisperResult.duration,
            transcriptionTime: whisperResult.processingTime
          };
          
        } catch (whisperError) {
          if (cancellationToken?.aborted) {
            await this.getJobStore().updateJobStatus(job_id, 'cancelled');
            return;
          }

          // Fallback to Azure if Whisper fails
          logger.warn(`Whisper transcription failed, falling back to Azure: ${whisperError instanceof Error ? whisperError.message : 'Unknown error'}`);
          await this.getJobStore().updateJobProgress(job_id, 60, 'Whisper failed, falling back to Azure Speech Services...');
          serviceUsed = 'azure_fallback';
          
          transcriptionResult = await this.getTranscribeService().transcribeAudio({
            audioId: `audio_${workflow_id}`,
            audioFilePath: audioFilePath
          });
        }
      }

      if (cancellationToken?.aborted) {
        await this.getJobStore().updateJobStatus(job_id, 'cancelled');
        return;
      }

      if (!transcriptionResult.success) {
        await this.getJobStore().setJobError(job_id, {
          code: 'TRANSCRIPTION_FAILED',
          message: transcriptionResult.error || 'Transcription failed',
          retryable: true,
          retry_after: 60000
        });
        await this.getStateStore().failStep(workflow_id, 'transcribe_audio', {
          message: transcriptionResult.error || 'Transcription failed',
          code: 'TRANSCRIPTION_FAILED',
          service_used: serviceUsed
        });
        return;
      }

      await this.getJobStore().updateJobProgress(job_id, 85, 'Cleaning up audio file...');

      // Clean up audio reference (workflow cleanup)
      const cleanupResult = await this.getReferenceService().cleanup(audio_url);

      await this.getJobStore().updateJobProgress(job_id, 95, 'Finalizing transcription...');

      // Complete transcribe audio step with results
      const stepResult = {
        raw_text: transcriptionResult.rawText,
        confidence: transcriptionResult.confidence,
        language: transcriptionResult.language,
        segments: transcriptionResult.segments,
        duration: transcriptionResult.duration,
        transcription_time: transcriptionResult.transcriptionTime,
        audio_cleaned: cleanupResult.success
      };

      await this.getStateStore().completeStep(workflow_id, 'transcribe_audio', stepResult);

      // Complete the job
      await this.getJobStore().setJobResult(job_id, {
        raw_text: transcriptionResult.rawText,
        segments: transcriptionResult.segments,
        language: transcriptionResult.language,
        confidence: transcriptionResult.confidence,
        duration: transcriptionResult.duration,
        transcriptionTime: transcriptionResult.transcriptionTime,
        service_used: serviceUsed,
        quality_used: quality,
        language_override: language || null,
        workflow_id,
        cleanup: cleanupResult,
        next_action: 'Enhance transcription using POST /enhance-transcription with this workflow_id, or proceed directly to analysis',
        message: `Audio transcribed successfully using ${serviceUsed}${serviceUsed === 'azure_fallback' ? ' (fallback)' : ''}. Audio file cleaned up. Text ready for enhancement or analysis.`
      });

      await this.getJobStore().updateJobStatus(job_id, 'completed');

      logger.info(`Audio transcribed successfully: workflow=${workflow_id}, text_length=${transcriptionResult.rawText?.length}, service=${serviceUsed}, job=${job_id}`);

    } catch (error: any) {
      // Fail the job and workflow step
      await this.getJobStore().setJobError(job_id, {
        code: 'TRANSCRIBE_AUDIO_FAILED',
        message: error?.message || 'Unknown transcription error',
        retryable: true,
        retry_after: 60000
      });

      await this.getStateStore().failStep(workflow_id, 'transcribe_audio', {
        message: error?.message || 'Unknown transcription error',
        code: 'TRANSCRIBE_AUDIO_FAILED',
        details: error
      });

      logger.error(`Audio transcription failed: workflow=${workflow_id}, job=${job_id}, error=${error?.message}`);
    }
  }
}
