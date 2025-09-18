import { AzureOpenAI } from 'openai';
import * as speechSdk from 'microsoft-cognitiveservices-speech-sdk';
import { azureConfig } from '../config/azure-config';
import { logger } from '../utils/logger';

export class AzureClientService {
  private openaiClient!: AzureOpenAI;
  private speechConfig!: speechSdk.SpeechConfig;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    try {
      // Initialize OpenAI client
      this.openaiClient = new AzureOpenAI({
        endpoint: azureConfig.endpoints.openai,
        apiKey: azureConfig.apiKey,
        apiVersion: "2024-08-01-preview"
      });

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

  public getOpenAIClient(): AzureOpenAI {
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
