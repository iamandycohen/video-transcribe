/**
 * Transcribe Audio Step - Handles audio-to-text transcription
 */

import { WorkflowStep } from '../base';

export interface TranscribeAudioStep extends WorkflowStep {
  result?: {
    raw_text: string;
    confidence: number;
    language: string;
    segments: Array<{
      text: string;
      startTime: number;
      endTime: number;
      confidence: number;
    }>;
    duration: number;
    transcription_time: number;
    audio_cleaned: boolean;
  };
}
