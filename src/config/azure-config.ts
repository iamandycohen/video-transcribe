import dotenv from 'dotenv';

// Load environment variables (local files take precedence)
dotenv.config({ path: '.env.local' });
dotenv.config(); // Load .env as fallback

export interface AzureConfig {
  subscriptionId: string;
  resourceGroup: string;
  accountName: string;
  apiKey: string;
  endpoints: {
    aiFoundry: string;
    openai: string;
    aiServices: string;
    speechToText: string;
    textToSpeech: string;
  };
  models: {
    gptTranscribe: string;
    gptAudio: string;
  };
  app: {
    logLevel: string;
    tempDir: string;
    outputDir: string;
    apiKey: string;
  };
}

export const azureConfig: AzureConfig = {
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
  resourceGroup: process.env.AZURE_RESOURCE_GROUP || '',
  accountName: process.env.AZURE_ACCOUNT_NAME || '',
  apiKey: process.env.AZURE_API_KEY || '',
  endpoints: {
    aiFoundry: process.env.AZURE_AI_FOUNDRY_ENDPOINT || '',
    openai: process.env.AZURE_OPENAI_ENDPOINT || '',
    aiServices: process.env.AZURE_AI_SERVICES_ENDPOINT || '',
    speechToText: process.env.AZURE_SPEECH_TO_TEXT_ENDPOINT || 'https://eastus2.stt.speech.microsoft.com',
    textToSpeech: process.env.AZURE_TEXT_TO_SPEECH_ENDPOINT || 'https://eastus2.tts.speech.microsoft.com'
  },
  models: {
    gptTranscribe: process.env.GPT_TRANSCRIBE_MODEL || 'gpt-4o-transcribe',
    gptAudio: process.env.GPT_AUDIO_MODEL || 'gpt-4o'
  },
  app: {
    logLevel: process.env.LOG_LEVEL || 'info',
    tempDir: process.env.TEMP_DIR || './temp',
    outputDir: process.env.OUTPUT_DIR || './output',
    apiKey: process.env.API_KEY || ''
  }
};

export function validateConfig(): void {
  const required = [
    'subscriptionId',
    'resourceGroup', 
    'accountName',
    'apiKey'
  ];

  const requiredEndpoints = [
    'aiFoundry',
    'openai',
    'aiServices'
  ];

  for (const field of required) {
    if (!azureConfig[field as keyof AzureConfig]) {
      throw new Error(`Missing required environment variable: AZURE_${field.toUpperCase()}`);
    }
  }

  for (const endpoint of requiredEndpoints) {
    if (!azureConfig.endpoints[endpoint as keyof typeof azureConfig.endpoints]) {
      throw new Error(`Missing required environment variable: AZURE_${endpoint.toUpperCase()}_ENDPOINT`);
    }
  }

  // Validate app API key
  if (!azureConfig.app.apiKey) {
    throw new Error('Missing required environment variable: API_KEY');
  }
}

