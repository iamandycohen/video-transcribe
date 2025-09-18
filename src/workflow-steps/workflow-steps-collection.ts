/**
 * Complete workflow steps collection interface
 */

import {
  UploadVideoStep,
  ExtractAudioStep,
  TranscribeAudioStep,
  EnhanceTranscriptionStep
} from './processing';

import {
  SummarizeContentStep,
  ExtractKeyPointsStep,
  AnalyzeSentimentStep,
  IdentifyTopicsStep
} from './analysis';

// Complete workflow steps collection
export interface WorkflowSteps {
  upload_video?: UploadVideoStep;
  extract_audio?: ExtractAudioStep;
  transcribe_audio?: TranscribeAudioStep;
  enhance_transcription?: EnhanceTranscriptionStep;
  summarize_content?: SummarizeContentStep;
  extract_key_points?: ExtractKeyPointsStep;
  analyze_sentiment?: AnalyzeSentimentStep;
  identify_topics?: IdentifyTopicsStep;
}
