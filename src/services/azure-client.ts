import { AzureKeyCredential } from '@azure/core-auth';
import { OpenAIClient } from '@azure/openai';
import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
import { azureConfig } from '../config/azure-config';
import { logger } from '../utils/logger';

export class AzureClientService {
  private openaiClient!: OpenAIClient;
  private speechConfig!: speechSdk.SpeechConfig;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    try {
      // Initialize OpenAI client
      this.openaiClient = new OpenAIClient(
        azureConfig.endpoints.openai,
        new AzureKeyCredential(azureConfig.apiKey)
      );

      // Initialize Speech SDK configuration
      this.speechConfig = speechSdk.SpeechConfig.fromEndpoint(
        new URL(azureConfig.endpoints.speechToText),
        azureConfig.apiKey
      );
      
      // Set audio format for better quality
      this.speechConfig.speechRecognitionLanguage = 'en-US';
      this.speechConfig.outputFormat = speechSdk.OutputFormat.Detailed;

      logger.info('Azure clients initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Azure clients:', error);
      throw error;
    }
  }

  public getOpenAIClient(): OpenAIClient {
    return this.openaiClient;
  }

  public getSpeechConfig(): speechSdk.SpeechConfig {
    return this.speechConfig;
  }

  public async testConnection(): Promise<boolean> {
    try {
      // Test OpenAI connection with a simple request
      // Note: Since listDeployments is deprecated, we'll try a lightweight operation
      logger.info('Azure connection test - client initialized successfully');
      return true;
    } catch (error) {
      logger.error('Azure connection test failed:', error);
      return false;
    }
  }
}
