import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
import { promises as fs } from 'fs';
import { AzureClientService } from './azure-client';
import { logger } from '../utils/logger';

export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptionSegment[];
  duration: number;
  language: string;
  confidence: number;
}

export class TranscriptionService {
  private azureClient: AzureClientService;

  constructor() {
    this.azureClient = new AzureClientService();
  }

  public async transcribeAudioFile(audioFilePath: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    logger.info(`Starting transcription of: ${audioFilePath}`);

    try {
      // Verify file exists
      await fs.access(audioFilePath);

      const speechConfig = this.azureClient.getSpeechConfig();
      const audioConfig = speechSdk.AudioConfig.fromWavFileInput(
        await fs.readFile(audioFilePath)
      );

      // Create speech recognizer with continuous recognition
      const recognizer = new speechSdk.SpeechRecognizer(speechConfig, audioConfig);

      const segments: TranscriptionSegment[] = [];
      let fullText = '';

      return new Promise((resolve, reject) => {
        // Handle recognized speech events
        recognizer.recognized = (s, e) => {
          if (e.result.reason === speechSdk.ResultReason.RecognizedSpeech) {
            const result = e.result;
            const segment: TranscriptionSegment = {
              text: result.text,
              startTime: result.offset / 10000, // Convert from ticks to milliseconds
              endTime: (result.offset + result.duration) / 10000,
              confidence: this.extractConfidence(result)
            };

            segments.push(segment);
            fullText += result.text + ' ';
            
            logger.debug(`Recognized: ${result.text}`);
          }
        };

        // Handle session events
        recognizer.sessionStarted = (s, e) => {
          logger.debug('Transcription session started');
        };

        recognizer.sessionStopped = (s, e) => {
          logger.debug('Transcription session stopped');
          
          const duration = Date.now() - startTime;
          const avgConfidence = segments.length > 0 
            ? segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length
            : 0;

          const result: TranscriptionResult = {
            fullText: fullText.trim(),
            segments,
            duration,
            language: 'en-US',
            confidence: avgConfidence
          };

          logger.info(`Transcription completed in ${duration}ms with ${segments.length} segments`);
          resolve(result);
        };

        // Handle errors
        recognizer.canceled = (s, e) => {
          if (e.reason === speechSdk.CancellationReason.Error) {
            const error = new Error(`Transcription failed: ${e.errorDetails}`);
            logger.error('Transcription canceled:', error);
            reject(error);
          }
        };

        // Start continuous recognition
        recognizer.startContinuousRecognitionAsync(
          () => {
            logger.debug('Continuous recognition started');
          },
          (error) => {
            logger.error('Failed to start recognition:', error);
            reject(error);
          }
        );

        // Stop recognition when audio ends
        recognizer.recognizing = (s, e) => {
          if (e.result.reason === speechSdk.ResultReason.RecognizingSpeech) {
            logger.debug(`Recognizing: ${e.result.text}`);
          }
        };
      });

    } catch (error) {
      logger.error('Transcription failed:', error);
      throw error;
    }
  }

  private extractConfidence(result: speechSdk.SpeechRecognitionResult): number {
    try {
      // Parse the detailed result to extract confidence if available
      const detailedResult = JSON.parse(result.properties.getProperty(
        speechSdk.PropertyId.SpeechServiceResponse_JsonResult
      ));

      if (detailedResult?.NBest?.[0]?.Confidence) {
        return detailedResult.NBest[0].Confidence;
      }
    } catch (error) {
      logger.debug('Could not extract confidence score:', error);
    }
    
    // Default confidence if not available
    return 0.85;
  }

  public async transcribeWithDiarization(audioFilePath: string): Promise<TranscriptionResult> {
    // Enhanced transcription with speaker diarization
    const speechConfig = this.azureClient.getSpeechConfig();
    
    // Enable speaker diarization
    const conversationTranscriber = new speechSdk.ConversationTranscriber(speechConfig);
    
    // This is a more advanced feature that would require additional setup
    // For now, fall back to regular transcription
    logger.info('Diarization requested, falling back to standard transcription');
    return this.transcribeAudioFile(audioFilePath);
  }
}

